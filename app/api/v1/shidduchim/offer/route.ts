import { NextRequest, NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendShidduchOfferEmails } from "@/lib/send-offer-email";
import { getEffectiveRole } from "@/lib/user";

const recipientScopeSchema = z.enum(["both", "groom_only", "bride_only"]);

const bodySchema = z.object({
  groomId: z.string().uuid(),
  brideId: z.string().uuid(),
  action: z.enum(["draft", "send"]),
  recipientScope: recipientScopeSchema.optional(),
  noteForGroom: z.string().max(8000).optional().default(""),
  noteForBride: z.string().max(8000).optional().default(""),
});

function isBlockingStatus(status: string) {
  return status !== "draft" && status !== "rejected";
}

export async function POST(req: NextRequest) {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = getEffectiveRole(user);
  if (role !== "shadchan" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    groomId,
    brideId,
    action,
    recipientScope,
    noteForGroom,
    noteForBride,
  } = parsed.data;

  if (action === "send" && !recipientScope) {
    return NextResponse.json(
      { error: "recipientScope נדרש לשליחה" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const [{ data: groom, error: gErr }, { data: bride, error: bErr }] =
    await Promise.all([
      admin
        .from("students")
        .select("id, gender, user_id, first_name, last_name")
        .eq("id", groomId)
        .single(),
      admin
        .from("students")
        .select("id, gender, user_id, first_name, last_name")
        .eq("id", brideId)
        .single(),
    ]);

  if (gErr || !groom || bErr || !bride) {
    return NextResponse.json(
      { error: "לא נמצאו כרטיסי סטודנטים" },
      { status: 404 },
    );
  }

  if (groom.gender !== "male" || bride.gender !== "female") {
    return NextResponse.json(
      { error: "יש לבחור מיועד (זכר) ומיועדת (נקבה) בהתאמה" },
      { status: 400 },
    );
  }

  const { data: pairRows, error: pairErr } = await admin
    .from("shidduchim")
    .select("id, status, shadchan_id, sent_at")
    .eq("groom_id", groomId)
    .eq("bride_id", brideId);

  if (pairErr) {
    console.error(pairErr);
    return NextResponse.json({ error: "שגיאת מסד" }, { status: 500 });
  }

  const rows = pairRows || [];
  const hasBlocking = rows.some((r) => isBlockingStatus(r.status));

  if (hasBlocking) {
    return NextResponse.json(
      {
        error:
          "לצמד הזה כבר קיימת הצעה פעילה או שהושלמה במערכת — לא ניתן לשמור או לשלוח שוב",
      },
      { status: 409 },
    );
  }

  const myDraft = rows.find(
    (r) => r.shadchan_id === user.id && r.status === "draft",
  );

  const groomName = `${groom.first_name || ""} ${groom.last_name || ""}`.trim();
  const brideName = `${bride.first_name || ""} ${bride.last_name || ""}`.trim();
  const shadchanName =
    `${user.user_metadata?.firstName || ""} ${user.user_metadata?.lastName || ""}`.trim() ||
    user.email ||
    "שדכן";

  if (action === "draft") {
    const payload = {
      groom_id: groomId,
      bride_id: brideId,
      shadchan_id: user.id,
      status: "draft" as const,
      note_for_groom: noteForGroom || null,
      note_for_bride: noteForBride || null,
      recipient_scope: null,
      sent_at: null,
    };

    if (myDraft) {
      const { data: updated, error: uErr } = await admin
        .from("shidduchim")
        .update({
          note_for_groom: payload.note_for_groom,
          note_for_bride: payload.note_for_bride,
          updated_at: new Date().toISOString(),
        })
        .eq("id", myDraft.id)
        .select("id")
        .single();

      if (uErr || !updated) {
        console.error(uErr);
        return NextResponse.json({ error: "שגיאה בעדכון טיוטה" }, { status: 500 });
      }
      return NextResponse.json({ ok: true, id: updated.id, status: "draft" });
    }

    const { data: inserted, error: iErr } = await admin
      .from("shidduchim")
      .insert(payload)
      .select("id")
      .single();

    if (iErr || !inserted) {
      console.error(iErr);
      return NextResponse.json({ error: "שגיאה בשמירת טיוטה" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: inserted.id, status: "draft" });
  }

  const [{ data: groomAuth }, { data: brideAuth }] = await Promise.all([
    admin.auth.admin.getUserById(groom.user_id),
    admin.auth.admin.getUserById(bride.user_id),
  ]);

  const groomParentEmail = groomAuth.user?.email ?? null;
  const brideParentEmail = brideAuth.user?.email ?? null;

  const nowIso = new Date().toISOString();
  const sendPayloadBase = {
    groom_id: groomId,
    bride_id: brideId,
    shadchan_id: user.id,
    status: "sent" as const,
    note_for_groom: noteForGroom || null,
    note_for_bride: noteForBride || null,
    recipient_scope: recipientScope!,
    sent_at: null as string | null,
    updated_at: nowIso,
  };

  let shidduchId: string;
  let wasDraftUpgrade: boolean;

  if (myDraft) {
    const { data: upgraded, error: uErr } = await admin
      .from("shidduchim")
      .update(sendPayloadBase)
      .eq("id", myDraft.id)
      .select("id")
      .single();

    if (uErr || !upgraded) {
      console.error(uErr);
      return NextResponse.json(
        { error: "שגיאה בהכנת רשומת השידוך לשליחה" },
        { status: 500 },
      );
    }
    shidduchId = upgraded.id;
    wasDraftUpgrade = true;
  } else {
    const { data: inserted, error: iErr } = await admin
      .from("shidduchim")
      .insert(sendPayloadBase)
      .select("id")
      .single();

    if (iErr || !inserted) {
      console.error(iErr);
      return NextResponse.json(
        { error: "שגיאה בשמירת רשומת השידוך לפני שליחת המייל" },
        { status: 500 },
      );
    }
    shidduchId = inserted.id;
    wasDraftUpgrade = false;
  }

  let sentTo: string[] = [];
  let sendGridMessageIds: string[] = [];

  try {
    const result = await sendShidduchOfferEmails({
      recipientScope: recipientScope!,
      groomParentEmail,
      brideParentEmail,
      groomName,
      brideName,
      noteForGroom: noteForGroom || "",
      noteForBride: noteForBride || "",
      shadchanName,
      shidduchId,
    });
    sentTo = result.sentTo;
    sendGridMessageIds = result.sendGridMessageIds;
    if (process.env.NODE_ENV === "development") {
      console.info("[shidduchim/offer] SendGrid sentTo:", sentTo, "messageIds:", sendGridMessageIds);
    }
  } catch (e) {
    console.error(e);
    if (wasDraftUpgrade) {
      await admin
        .from("shidduchim")
        .update({
          status: "draft",
          recipient_scope: null,
          sent_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", shidduchId);
    } else {
      await admin.from("shidduchim").delete().eq("id", shidduchId);
    }
    const msg = e instanceof Error ? e.message : "שגיאת שליחה";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const sentAt = new Date().toISOString();
  const { error: finErr } = await admin
    .from("shidduchim")
    .update({ sent_at: sentAt, updated_at: sentAt })
    .eq("id", shidduchId);

  if (finErr) {
    console.error(finErr);
    return NextResponse.json(
      { error: "המייל נשלח אך עדכון חותמת השליחה נכשל — יש לפנות למנהל" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: shidduchId,
    status: "sent",
    sentTo,
    sendGridMessageIds,
  });
}
