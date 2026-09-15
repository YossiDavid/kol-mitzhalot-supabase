import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  SIGNED_PHOTO_URL_TTL_SECONDS,
  STUDENT_PHOTOS_BUCKET,
} from "@/features/students/lib/student-photo-rules";

/**
 * קריאת גלריית התמונות של כרטיס - לקוד שרת בלבד. student_photos סגורה
 * ללקוחות, ולכן הקריאה והחתימה נעשות ב-service role.
 *
 * ההרשאה היא אחריות הקורא: canView חייב לשקף את can_view_student_photo
 * (בן, בעל הכרטיס, מנהל, או שדכן עם אישור צפייה). בלי canView לא נוצר אף
 * קישור חתום.
 */

export type StudentPhotoView = { path: string; url: string };

export type StudentPhotos = {
  /** כמה תמונות שמורות - גם כשאין הרשאה לראות אותן */
  count: number;
  /** הנתיבים לפי הסדר. לשימוש בעריכה בלבד (שימור הסדר), לא לתצוגה */
  paths: string[];
  /** קישורים חתומים, רק כש-canView */
  photos: StudentPhotoView[];
};

const EMPTY: StudentPhotos = { count: 0, paths: [], photos: [] };

export async function loadStudentPhotos(
  studentId: string,
  { canView }: { canView: boolean },
): Promise<StudentPhotos> {
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("student_photos")
    .select("storage_path")
    .eq("student_id", studentId)
    .order("position", { ascending: true });

  if (error) {
    console.error("[students/photos] load", describeSupabaseError(error));
    return EMPTY;
  }

  const paths = (rows ?? []).map((row) => row.storage_path as string);
  if (!canView || paths.length === 0) {
    return { count: paths.length, paths, photos: [] };
  }

  const { data: signed, error: signError } = await admin.storage
    .from(STUDENT_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_PHOTO_URL_TTL_SECONDS);

  if (signError) {
    console.error("[students/photos] sign", signError);
    return { count: paths.length, paths, photos: [] };
  }

  // קובץ שנמחק מהאחסון מחזיר שגיאה פרטנית - מדלגים עליו ולא מפילים את הגלריה
  const photos = (signed ?? []).flatMap((item) =>
    item.path && item.signedUrl && !item.error
      ? [{ path: item.path, url: item.signedUrl }]
      : [],
  );

  return { count: paths.length, paths, photos };
}

/**
 * התמונה הראשית (המיקום הנמוך ביותר) של כל כרטיס, חתומה - לטבלת המיועדים.
 * בקשה אחת לטבלה ובקשת חתימה אחת לכל הקישורים.
 *
 * ההרשאה היא אחריות הקורא: מעבירים רק כרטיסים שהצופה רשאי לראות, כך
 * שנתיבים של כרטיס נעול אינם נקראים כלל. זורקת בכשל - כדי שהטבלה לא
 * תציג "אין תמונה" לכרטיס שיש לו.
 */
export async function loadPrimaryPhotoUrls(
  studentIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (studentIds.length === 0) return new Map();
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("student_photos")
    .select("student_id, storage_path")
    .in("student_id", [...studentIds])
    .order("position", { ascending: true });

  if (error) {
    console.error(
      "[students/photos] load primary",
      describeSupabaseError(error),
    );
    throw new Error("loading primary photos failed");
  }

  // השורות ממוינות לפי מיקום - הראשונה לכל כרטיס היא הראשית
  const studentByPrimaryPath = new Map<string, string>();
  const seenStudents = new Set<string>();
  for (const row of rows ?? []) {
    const studentId = row.student_id as string;
    if (seenStudents.has(studentId)) continue;
    seenStudents.add(studentId);
    studentByPrimaryPath.set(row.storage_path as string, studentId);
  }
  if (studentByPrimaryPath.size === 0) return new Map();

  const { data: signed, error: signError } = await admin.storage
    .from(STUDENT_PHOTOS_BUCKET)
    .createSignedUrls(
      [...studentByPrimaryPath.keys()],
      SIGNED_PHOTO_URL_TTL_SECONDS,
    );

  if (signError) {
    console.error("[students/photos] sign primary", signError);
    throw new Error("signing primary photos failed");
  }

  // קובץ שנמחק מהאחסון מחזיר שגיאה פרטנית - הכרטיס פשוט יוצג בלי תמונה
  return new Map(
    (signed ?? []).flatMap((item) => {
      const studentId = item.path ? studentByPrimaryPath.get(item.path) : null;
      return studentId && item.signedUrl && !item.error
        ? [[studentId, item.signedUrl] as const]
        : [];
    }),
  );
}
