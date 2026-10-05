import type { SupabaseClient } from "@supabase/supabase-js";

import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * האם הצופה רשאי לראות את תמונות הכרטיס - לקוד שרת. ההכרעה לכל מגדר נעשית
 * ב-can_view_student_photo (בן: אלא אם הוסתר בהצעה; בת: בעל הכרטיס, מנהל,
 * או אישור צפייה), כדי שלא ייגזר כאן כלל מקביל.
 *
 * כשל בבדיקה נחשב "לא רשאי" - לעולם לא נחשפת תמונה בגלל שגיאה.
 */

export type PhotoAccessSubject = { id: string; gender?: string | null };

/** כמה בדיקות הרשאה רצות במקביל מול המסד ברשימה ארוכה */
const ACCESS_CHECK_CONCURRENCY = 10;

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

/** המזהים מתוך students שהצופה רשאי לראות את תמונותיהם */
export async function resolveViewablePhotoIds(
  supabase: SupabaseClient,
  viewerId: string,
  students: readonly PhotoAccessSubject[],
): Promise<ReadonlySet<string>> {
  const chunks = Array.from(
    { length: Math.ceil(students.length / ACCESS_CHECK_CONCURRENCY) },
    (_, index) =>
      students.slice(
        index * ACCESS_CHECK_CONCURRENCY,
        (index + 1) * ACCESS_CHECK_CONCURRENCY,
      ),
  );

  const withheldGrooms = await loadWithheldGroomIds(
    supabase,
    students.filter((student) => student.gender === "male").map(({ id }) => id),
  );

  let viewable: string[] = [];
  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map((student) => canViewStudentPhoto(supabase, viewerId, student)),
    );
    viewable = [
      ...viewable,
      ...chunk
        .filter(
          (student, index) => results[index] && !withheldGrooms.has(student.id),
        )
        .map(({ id }) => id),
    ];
  }
  return new Set(viewable);
}
