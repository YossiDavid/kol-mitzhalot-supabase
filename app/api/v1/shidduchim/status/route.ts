import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isShidduchStatus,
  SHIDDUCH_STATUS_LABELS,
  SHIDDUCH_STATUS_VALUES,
} from "@/features/shidduchim/lib/status";
import { closeMatchInSystem } from "@/features/engagements/lib/close-match";
import {
  dbBlockFromError,
  proposalBlocksBody,
} from "@/features/shidduchim/lib/proposal-gate";
import { hasRole } from "@/lib/user";

const bodySchema = z.object({
  shidduchId: z.guid(),
  status: z.string(),
});

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = hasRole(user, "admin");
  if (!isAdmin && !hasRole(user, "shadchan")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { shidduchId, status } = parsed.data;

  if (!isShidduchStatus(status)) {
    return NextResponse.json(
      {
        error: "Invalid status",
        allowed: SHIDDUCH_STATUS_VALUES,
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existing, error: fetchError } = await admin
    .from("shidduchim")
    .select("id, shadchan_id")
    .eq("id", shidduchId)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Shidduch not found" }, { status: 404 });
  }

  if (!isAdmin && existing.shadchan_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // דרך RPC ולא update ישיר: הכתיבה היא ב-service role (auth.uid() ריק),
  // והפונקציה מציבה את המבצע בטרנזקציה כדי שהשדכן לא יקבל התראה על שינוי
  // הסטטוס שביצע בעצמו (notify_shidduch_response).
  const { data: rows, error: updateError } = await admin.rpc(
    "set_shidduch_status_as",
    { p_shidduch_id: shidduchId, p_status: status, p_actor: user.id },
  );
  const result = (
    rows as
      | { out_id: string; out_status: string; out_updated_at: string }[]
      | null
  )?.[0];

  // פתיחה מחדש של הצעה שנדחתה היא שליחה חוזרת: כרטיס מושהה או שמיצה את
  // המכסה חוסם אותה במסד, וכאן זה מוצג כהודעה ברורה (409)
  const gateBlock = dbBlockFromError(updateError);
  if (gateBlock) {
    return NextResponse.json(proposalBlocksBody([gateBlock]), { status: 409 });
  }

  if (updateError || !result) {
    console.error(updateError);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 },
    );
  }

  const updated = {
    id: result.out_id,
    status: result.out_status,
    updated_at: result.out_updated_at,
  };

  // שידוך שהושלם בתוך המערכת: כרטיסים מאורסים ומודעת אירוסין לא מפורסמת
  // (לאישור מנהל). כשל כאן אינו מבטל את הסטטוס שכבר נשמר - הוא מוחזר
  // כדגל כדי שהממשק יוכל להזהיר.
  const engagementWarning =
    status === "completed"
      ? (await closeMatchInSystem(admin, { shidduchId, actor: user }))
          .hasWarning
      : false;

  return NextResponse.json({
    ok: true,
    row: updated,
    statusLabel: SHIDDUCH_STATUS_LABELS[status],
    engagementWarning,
  });
}
