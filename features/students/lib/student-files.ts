/**
 * קו"ח ומסמכים רפואיים של כרטיס: במסד נשמר נתיב הקובץ ב-bucket "students"
 * (`<student_id>/...`), לא קישור. הקישור נחתם לכמה דקות בכל צפייה, בנתיב
 * /api/v1/students/[id]/files, אחרי בדיקת הרשאה. כך אפשר לבטל גישה
 * (הצעה שנסגרה, שדכן שהוקפא) - קישור חתום לשנה שנשמר במסד לא בוטל לעולם.
 */

export type StudentFileKind = "cv" | "medical";

/** מה שקודם נשמר במסד: signed URL של Supabase Storage */
const SIGNED_URL_MARKER = "/object/sign/students/";

/**
 * נתיב הקובץ מתוך הערך שבמסד: נתיב (המצב החדש), או קישור חתום ישן שממנו
 * מחלצים את הנתיב. כל דבר אחר (כתובת חיצונית) - null.
 */
export function toStudentStoragePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const markerAt = trimmed.indexOf(SIGNED_URL_MARKER);
  if (markerAt >= 0) {
    const rest = trimmed.slice(markerAt + SIGNED_URL_MARKER.length);
    return decodeURIComponent(rest.split("?")[0] ?? "") || null;
  }
  return trimmed.includes("://") ? null : trimmed;
}

/** הנתיב שייך לכרטיס הזה (ובלי ניסיון לצאת מהתיקייה) */
export function isPathOfStudent(path: string, studentId: string): boolean {
  return path.startsWith(`${studentId}/`) && !path.includes("..");
}

/** הקישור שמוצג בממשק: נחתם בשרת בכל לחיצה */
export function studentFileHref(
  studentId: string,
  kind: StudentFileKind,
  index = 0,
): string {
  return kind === "cv"
    ? `/api/v1/students/${studentId}/files/cv`
    : `/api/v1/students/${studentId}/files/medical/${index}`;
}
