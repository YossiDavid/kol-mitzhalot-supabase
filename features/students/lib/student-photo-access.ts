import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * האם הצופה רשאי לראות את תמונות הכרטיס - לקוד שרת. ההכרעה לכל מגדר נעשית
 * ב-can_view_student_photo (בן: אלא אם הוסתר בהצעה; בת: בעל הכרטיס, מנהל,
 * או אישור צפייה), כדי שלא ייגזר כאן כלל מקביל.
 *
 * כשל בבדיקה נחשב "לא רשאי" - לעולם לא נחשפת תמונה בגלל שגיאה.
 */

export type PhotoAccessSubject = { id: string; gender?: string | null };

/**
 * המזהים (מתוך הרשימה) של בחורים שתמונותיהם מוסתרות מהצופה המחובר: הוא הגיע
 * אליהם רק דרך הצעה, ואף הצעה שמקשרת אותו אליהם אינה משתפת תמונה
 * (shidduchim.share_groom_photo). הכרעה אחת במסד לכל הרשימה.
 *
 * כשל בבדיקה נחשב "מוסתר" לכל הרשימה - לעולם לא נחשפת תמונה בגלל שגיאה.
 */
async function loadWithheldGroomIds(
  supabase: SupabaseClient,
  groomIds: readonly string[],
): Promise<ReadonlySet<string>> {
  if (groomIds.length === 0) return new Set();

  const { data, error } = await supabase.rpc("withheld_groom_photo_ids", {
    p_student_ids: groomIds,
  });
  if (error) {
    console.error(
      "[students/photos] withheld_groom_photo_ids failed",
      describeSupabaseError(error),
    );
    return new Set(groomIds);
  }
  return new Set((data ?? []) as string[]);
}

/** האם תמונות הבחור מוסתרות מהצופה. לשימוש בכרטיס עצמו */
export async function isGroomPhotoWithheld(
  supabase: SupabaseClient,
  studentId: string,
): Promise<boolean> {
  const withheld = await loadWithheldGroomIds(supabase, [studentId]);
  return withheld.has(studentId);
}

export async function canViewStudentPhoto(
  supabase: SupabaseClient,
  viewerId: string | null,
  student: PhotoAccessSubject,
): Promise<boolean> {
  // אין קיצור דרך לבנים: גם אצלם ההכרעה (תמונה מוסתרת כשהגעה דרך הצעה בלי
  // share_groom_photo) נעשית רק ב-can_view_student_photo.
  const { data, error } = await supabase.rpc("can_view_student_photo", {
    uid: viewerId,
    sid: student.id,
  });
  if (error) {
    console.error(
      "[students/photos] can_view_student_photo failed",
      student.id,
      describeSupabaseError(error),
    );
    return false;
  }
  return data === true;
}

/**
 * המזהים מתוך students שהצופה רשאי לראות את תמונותיהם. קריאה אחת לכל
 * הרשימה (viewable_student_photo_ids, אותו כלל כמו can_view_student_photo).
 * כשל = אין תמונות (סגור כברירת מחדל).
 */
export async function resolveViewablePhotoIds(
  supabase: SupabaseClient,
  students: readonly PhotoAccessSubject[],
): Promise<ReadonlySet<string>> {
  if (students.length === 0) return new Set();

  const [withheldGrooms, viewable] = await Promise.all([
    loadWithheldGroomIds(
      supabase,
      students.filter((student) => student.gender === "male").map(({ id }) => id),
    ),
    supabase.rpc("viewable_student_photo_ids", {
      p_student_ids: students.map(({ id }) => id),
    }),
  ]);
  if (viewable.error) {
    console.error(
      "[students/photos] viewable_student_photo_ids failed",
      describeSupabaseError(viewable.error),
    );
    return new Set();
  }
  const allowed = new Set((viewable.data ?? []) as string[]);
  return new Set(
    students
      .filter(({ id }) => allowed.has(id) && !withheldGrooms.has(id))
      .map(({ id }) => id),
  );
}

/**
 * קישור השיתוף הציבורי: הצופה אינו מזוהה, ולכן ייתכן שזה הצד השני של הצעה
 * ששדכן סימן בה "בלי תמונה". בחור שנשלח בהצעה כזו (לא טיוטה, כשהצד של הכלה
 * מקבל אותה) אינו מציג גלריה בקישור הציבורי - אחרת מספיק לפתוח את הכרטיס
 * בגלישה בסתר כדי לעקוף את ההחלטה של השדכן.
 */
export async function isGroomPhotoWithheldInAnyProposal(
  groomId: string,
): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("shidduchim")
    .select("id")
    .eq("groom_id", groomId)
    .neq("status", "draft")
    .in("recipient_scope", ["both", "bride_only"])
    .eq("share_groom_photo", false)
    .limit(1);
  if (error) {
    // כשל בבדיקה: לא חושפים (fail closed)
    console.error(describeSupabaseError(error));
    return true;
  }
  return (data ?? []).length > 0;
}
