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
