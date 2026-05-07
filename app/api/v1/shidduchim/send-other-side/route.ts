import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendShidduchOfferEmails } from "@/lib/send-offer-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveRole } from "@/lib/user";

const bodySchema = z.object({
  shidduchId: z.string().uuid(),
  note: z.string().max(8000).optional().default(""),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getEffectiveRole(user);
  if (role !== "admin" && role !== "shadchan") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { shidduchId, note } = parsed.data;
  const admin = createAdminClient();

  const { data: shidduch, error: shidduchErr } = await admin
    .from("shidduchim")
    .select(
      "id, shadchan_id, groom_id, bride_id, note_for_groom, note_for_bride, recipient_scope",
    )
    .eq("id", shidduchId)
    .maybeSingle();

  if (shidduchErr || !shidduch) {
    return NextResponse.json({ error: "Shidduch not found" }, { status: 404 });
  }

  if (role !== "admin" && shidduch.shadchan_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    shidduch.recipient_scope !== "groom_only" &&
    shidduch.recipient_scope !== "bride_only"
  ) {
    return NextResponse.json(
      { error: "ניתן לבצע שליחה משלימה רק כשההצעה נשלחה לצד אחד" },
      { status: 400 },
    );
  }

  const missingScope =
    shidduch.recipient_scope === "groom_only" ? "bride_only" : "groom_only";
  const trimmedNote = note.trim();
  const notePatch =
    missingScope === "groom_only"
      ? { note_for_groom: trimmedNote || shidduch.note_for_groom }
      : { note_for_bride: trimmedNote || shidduch.note_for_bride };

  const [{ data: groom }, { data: bride }] = await Promise.all([
    admin
      .from("students")
      .select("id, user_id, first_name, last_name")
      .eq("id", shidduch.groom_id)
      .single(),
    admin
      .from("students")
      .select("id, user_id, first_name, last_name")
      .eq("id", shidduch.bride_id)
      .single(),
  ]);

  if (!groom || !bride) {
    return NextResponse.json({ error: "פרטי מועמדים חסרים" }, { status: 404 });
  }

  const [{ data: groomAuth }, { data: brideAuth }] = await Promise.all([
    admin.auth.admin.getUserById(groom.user_id),
    admin.auth.admin.getUserById(bride.user_id),
  ]);

  const groomParentEmail = groomAuth.user?.email ?? null;
  const brideParentEmail = brideAuth.user?.email ?? null;

  const groomName = `${groom.first_name || ""} ${groom.last_name || ""}`.trim();
  const brideName = `${bride.first_name || ""} ${bride.last_name || ""}`.trim();
  const shadchanName =
    `${user.user_metadata?.firstName || ""} ${user.user_metadata?.lastName || ""}`.trim() ||
    user.email ||
    "שדכן";

  try {
    const result = await sendShidduchOfferEmails({
      recipientScope: missingScope,
      groomParentEmail,
      brideParentEmail,
      groomName,
      brideName,
      noteForGroom: shidduch.note_for_groom || "",
      noteForBride: shidduch.note_for_bride || "",
      shadchanName,
      shidduchId: shidduch.id,
    });

    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from("shidduchim")
      .update({
        ...notePatch,
        recipient_scope: "both",
        status: "sent",
        sent_at: now,
        updated_at: now,
      })
      .eq("id", shidduch.id);

    if (updErr) {
      console.error(updErr);
      return NextResponse.json(
        { error: "המייל נשלח אך עדכון היקף השליחה נכשל" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      sentTo: result.sentTo,
      sendGridMessageIds: result.sendGridMessageIds,
      recipientScope: "both",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאת שליחה";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
