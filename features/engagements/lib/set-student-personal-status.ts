import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export const PERSONAL_STATUS_VALUES = [
  "single",
  "divorced",
  "widowed",
  "engaged",
  "married",
] as const;

export type PersonalStatus = (typeof PERSONAL_STATUS_VALUES)[number];

/**
 * עדכון הסטטוס האישי של כרטיס - הלוגיקה המשותפת ל-PATCH /api/v1/students/[id]/status
 * ולסגירת שידוך במערכת (שמסמנת את שני הכרטיסים כמאורסים).
 *
 * אירוסין/נישואין מוציאים את הכרטיס משידוכים, וחזרה לרווק/גרוש/אלמן
 * מחזירה אותו. בלי הצד השני של התנאי, תיקון סטטוס שגוי היה משאיר את
 * הכרטיס עם in_shidduchim=false והוא היה נעלם מהרשימה בלי שאיש ישים לב.
 *
 * כותב עם service role - הקורא אחראי לבדוק הרשאות לפני הקריאה.
 */
export async function setStudentPersonalStatus(
  admin: AdminClient,
  studentId: string,
  status: PersonalStatus,
) {
  const isEngagedOrMarried = status === "engaged" || status === "married";

  return admin
    .from("students")
    .update({
      personal_status: status,
      status_changed_at: new Date().toISOString(),
      in_shidduchim: !isEngagedOrMarried,
    })
    .eq("id", studentId)
    .is("deleted_at", null)
    .select("id, personal_status, in_shidduchim, status_changed_at")
    .maybeSingle();
}
