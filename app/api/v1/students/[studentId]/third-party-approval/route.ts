import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isThirdPartyCardFor } from "@/features/students/lib/third-party-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

const bodySchema = z.object({
  /** full_display: הצגת נתונים מלאים. proposals: אפשרות לקבל הצעות */
  kind: z.enum(["full_display", "proposals"]),
  approved: z.boolean(),
});

const COLUMNS_BY_KIND = {
  full_display: {
    at: "third_party_full_display_approved_at",
    by: "third_party_full_display_approved_by",
  },
  proposals: {
    at: "third_party_proposals_approved_at",
    by: "third_party_proposals_approved_by",
  },
} as const;

const RETURNED_COLUMNS =
  "id, third_party_full_display_approved_at, third_party_full_display_approved_by, third_party_proposals_approved_at, third_party_proposals_approved_by";

/**
 * אישור הנהלה לכרטיס שמולא על ידי צד שלישי, ובטולו. שני אישורים בלתי תלויים:
 * הצגת נתונים מלאים, ואפשרות לקבל הצעות. מנהל מערכת בלבד; הכתיבה ב-service
 * role, והמסד (enforce_third_party_approval_lock) מונע מכל כותב אחר לשנות אותם.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!z.uuid().safeParse(studentId).success) {
    return NextResponse.json({ error: "מזהה כרטיס לא תקין" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasRole(user, "admin")) {
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
  const { kind, approved } = parsed.data;

  const admin = createAdminClient();

  const { data: student, error: readError } = await admin
    .from("students")
    .select("id, card_for")
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) {
    console.error(
      "[students/third-party-approval] read failed",
      studentId,
      describeSupabaseError(readError),
    );
    return NextResponse.json({ error: "שגיאת מסד" }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ error: "הכרטיס לא נמצא" }, { status: 404 });
  }
  if (!isThirdPartyCardFor(student.card_for)) {
    return NextResponse.json(
      { error: "האישור חל רק על כרטיס שמולא על ידי צד שלישי" },
      { status: 409 },
    );
  }

  const columns = COLUMNS_BY_KIND[kind];
  const patch = approved
    ? { [columns.at]: new Date().toISOString(), [columns.by]: user.id }
    : { [columns.at]: null, [columns.by]: null };

  const { data: updated, error: updateError } = await admin
    .from("students")
    .update(patch)
    .eq("id", studentId)
    .select(RETURNED_COLUMNS)
    .maybeSingle();

  if (updateError || !updated) {
    console.error(
      "[students/third-party-approval] update failed",
      studentId,
      updateError ? describeSupabaseError(updateError) : "no row",
    );
    return NextResponse.json({ error: "עדכון האישור נכשל" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: updated });
}
