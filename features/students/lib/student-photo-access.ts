import type { SupabaseClient } from "@supabase/supabase-js";

import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * האם הצופה רשאי לראות את תמונות הכרטיס - לקוד שרת. תמונת בן גלויה תמיד;
 * אצל בת ההכרעה נעשית ב-can_view_student_photo (בעל הכרטיס, מנהל, או
 * אישור צפייה), כדי שלא ייגזר כאן כלל מקביל.
 *
 * כשל בבדיקה נחשב "לא רשאי" - לעולם לא נחשפת תמונה בגלל שגיאה.
 */

export type PhotoAccessSubject = { id: string; gender?: string | null };

/** כמה בדיקות הרשאה רצות במקביל מול המסד ברשימה ארוכה */
const ACCESS_CHECK_CONCURRENCY = 10;

export async function canViewStudentPhoto(
  supabase: SupabaseClient,
  viewerId: string | null,
  student: PhotoAccessSubject,
): Promise<boolean> {
  if (student.gender !== "female") return true;

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

  let viewable: string[] = [];
  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map((student) => canViewStudentPhoto(supabase, viewerId, student)),
    );
    viewable = [
      ...viewable,
      ...chunk.filter((_, index) => results[index]).map(({ id }) => id),
    ];
  }
  return new Set(viewable);
}
