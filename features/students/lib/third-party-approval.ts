import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * מצב אישורי ההנהלה של כרטיס, כפי שהוא נקרא לפני שליפת הכרטיס עצמו: הוא
 * קובע איזה select מותר בכלל (student-card-data.ts, BASIC_STUDENT_SELECT).
 *
 * כשל בקריאה נחשב "כרטיס צד שלישי שלא אושר" (סגור כברירת מחדל): עדיף כרטיס
 * עם נתונים בסיסיים מכרטיס שנחשף בגלל שגיאה. כרטיס שלא נמצא (או חסום
 * ב-RLS) מחזיר null, וההמשך הרגיל של הדף מטפל בו.
 */

const COLUMNS =
  "user_id, card_for, third_party_full_display_approved_at, third_party_full_display_approved_by, third_party_proposals_approved_at, third_party_proposals_approved_by";

const approvalRowSchema = z.object({
  user_id: z.string(),
  card_for: z.string().nullable(),
  third_party_full_display_approved_at: z.string().nullable(),
  third_party_full_display_approved_by: z.string().nullable(),
  third_party_proposals_approved_at: z.string().nullable(),
  third_party_proposals_approved_by: z.string().nullable(),
});

export type ThirdPartyApprovalRow = z.infer<typeof approvalRowSchema>;

/** שורה שנחשבת צד שלישי לא מאושר - בכשל בקריאה */
const FAIL_CLOSED_ROW: ThirdPartyApprovalRow = {
  user_id: "",
  card_for: "other",
  third_party_full_display_approved_at: null,
  third_party_full_display_approved_by: null,
  third_party_proposals_approved_at: null,
  third_party_proposals_approved_by: null,
};

export async function loadThirdPartyApproval(
  client: SupabaseClient,
  studentId: string,
): Promise<ThirdPartyApprovalRow | null> {
  const { data, error } = await client
    .from("students")
    .select(COLUMNS)
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(
      "[students/third-party] approval lookup failed",
      studentId,
      describeSupabaseError(error),
    );
    return FAIL_CLOSED_ROW;
  }
  if (!data) return null;

  const parsed = approvalRowSchema.safeParse(data);
  if (!parsed.success) {
    console.error(
      "[students/third-party] unexpected approval row",
      parsed.error.issues,
    );
    return FAIL_CLOSED_ROW;
  }
  return parsed.data;
}
