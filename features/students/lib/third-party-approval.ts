import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { CARD_APPROVAL_COLUMNS } from "@/features/students/lib/card-approval";
import { STUDENT_CARDS_VIEW } from "@/features/students/lib/third-party-card";

/**
 * מצב אישורי ההנהלה של כרטיס, כפי שהוא נקרא לפני שליפת הכרטיס עצמו: הוא
 * קובע איזה select מותר בכלל (student-card-data.ts, BASIC_STUDENT_SELECT).
 *
 * כשל בקריאה נחשב "כרטיס צד שלישי שלא אושר" (סגור כברירת מחדל): עדיף כרטיס
 * עם נתונים בסיסיים מכרטיס שנחשף בגלל שגיאה. כרטיס שלא נמצא (או חסום
 * ב-RLS) מחזיר null, וההמשך הרגיל של הדף מטפל בו.
 */

const COLUMNS = `user_id, card_for, third_party_full_display_approved_at, third_party_full_display_approved_by, third_party_proposals_approved_at, third_party_proposals_approved_by, ${CARD_APPROVAL_COLUMNS}`;

const approvalRowSchema = z.object({
  user_id: z.string(),
  card_for: z.string().nullable(),
  third_party_full_display_approved_at: z.string().nullable(),
  third_party_full_display_approved_by: z.string().nullable(),
  third_party_proposals_approved_at: z.string().nullable(),
  third_party_proposals_approved_by: z.string().nullable(),
  // אישור ההנהלה לכרטיס עצמו (card-approval.ts). ב-view הדחייה והסיבה חוזרות
  // רק לבעל הכרטיס ולמנהל.
  admin_approved_at: z.string().nullable(),
  admin_rejected_at: z.string().nullable(),
  admin_rejection_reason: z.string().nullable(),
});

export type ThirdPartyApprovalRow = z.infer<typeof approvalRowSchema>;

/** שורה שנחשבת צד שלישי לא מאושר וכרטיס שלא אושר - בכשל בקריאה */
const FAIL_CLOSED_ROW: ThirdPartyApprovalRow = {
  user_id: "",
  card_for: "other",
  third_party_full_display_approved_at: null,
  third_party_full_display_approved_by: null,
  third_party_proposals_approved_at: null,
  third_party_proposals_approved_by: null,
  admin_approved_at: null,
  admin_rejected_at: null,
  admin_rejection_reason: null,
};

/**
 * מאיפה נקראים האישורים. משתמש מחובר קורא את ה-view (student_cards), כי שורת
 * students של כרטיס מוגבל אינה נקראת ישירות על ידי שדכן או איש צוות;
 * ה-service role (גולש לא מחובר) קורא את הטבלה עצמה - ה-view מסנן לפי המשתמש
 * המחובר ולכן ריק עבורו.
 */
export type ApprovalSource = typeof STUDENT_CARDS_VIEW | "students";

export async function loadThirdPartyApproval(
  client: SupabaseClient,
  studentId: string,
  source: ApprovalSource,
): Promise<ThirdPartyApprovalRow | null> {
  const { data, error } = await client
    .from(source)
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
