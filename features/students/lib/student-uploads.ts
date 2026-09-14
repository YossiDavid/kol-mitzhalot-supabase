import type { createClient } from "@/lib/supabase/client";
import {
  STUDENT_PHOTOS_BUCKET,
  type StudentPhotoItem,
} from "@/features/students/lib/student-photo-rules";

// העלאת קבצי כרטיס (גלריית תמונות, קו״ח, מסמכים רפואיים) ל-Storage. משותף
// ליצירה ולעריכה — שני המסלולים שומרים לאותו bucket ובאותה מוסכמת נתיבים.

type BrowserSupabaseClient = ReturnType<typeof createClient>;

export type StudentFileKind = "cv" | "medical";

/** תוקף ה-signed URL של קו״ח ומסמכים: שנה. Public URL אינו אפשרי כי ה-bucket פרטי. */
const SIGNED_URL_TTL_SECONDS = 31536000;
const MAX_FILE_NAME_LENGTH = 100;
const DEFAULT_CV_EXTENSION = "pdf";
const DEFAULT_PHOTO_EXTENSION = "jpg";

/**
 * Supabase Storage לא מקבל תווים עבריים ותווים מיוחדים ב-URL, ולכן שם הקובץ
 * מנוקה לפני ההעלאה.
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName || fileName.trim().length === 0) {
    return "file";
  }

  const lastDot = fileName.lastIndexOf(".");
  const name = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.substring(lastDot).toLowerCase() : "";

  const sanitized =
    name
      .replace(/[֐-׿]/g, "")
      .replace(/[^a-zA-Z0-9\-_]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, MAX_FILE_NAME_LENGTH) || "file";

  return sanitized + ext;
}

function fileExtension(file: File, fallback: string): string {
  const sanitized = sanitizeFileName(file.name);
  const lastDot = sanitized.lastIndexOf(".");
  return lastDot > 0 ? sanitized.substring(lastDot + 1) : fallback;
}

function buildStoragePath(
  studentId: string,
  file: File,
  kind: StudentFileKind,
): string {
  if (kind === "medical") {
    return `${studentId}/medical/${Date.now()}-${sanitizeFileName(file.name)}`;
  }
  return `${studentId}/${Date.now()}-cv.${fileExtension(file, DEFAULT_CV_EXTENSION)}`;
}

async function uploadToStudentsBucket(
  supabase: BrowserSupabaseClient,
  path: string,
  file: File,
): Promise<boolean> {
  const { error } = await supabase.storage
    .from(STUDENT_PHOTOS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error("Error uploading student file:", path, error);
    return false;
  }
  return true;
}

/**
 * מעלה קו״ח או מסמך רפואי ומחזיר signed URL, או null אם ההעלאה נכשלה.
 * כישלון אינו זורק: כרטיס עם קובץ חסר עדיף על שמירה שנפלה כולה.
 */
export async function uploadStudentFile(
  supabase: BrowserSupabaseClient,
  studentId: string,
  file: File,
  kind: StudentFileKind,
): Promise<string | null> {
  const path = buildStoragePath(studentId, file, kind);
  if (!(await uploadToStudentsBucket(supabase, path, file))) return null;

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(STUDENT_PHOTOS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signedUrlError || !signedUrlData) {
    console.error("Error signing student file URL:", kind, signedUrlError);
    return null;
  }

  return signedUrlData.signedUrl;
}

/** מעלה את כל המסמכים הרפואיים ומחזיר את הכתובות שהצליחו. */
export async function uploadMedicalDocuments(
  supabase: BrowserSupabaseClient,
  studentId: string,
  documents: unknown[],
): Promise<string[]> {
  const urls: string[] = [];

  for (const document of documents) {
    if (!(document instanceof File)) continue;
    const url = await uploadStudentFile(
      supabase,
      studentId,
      document,
      "medical",
    );
    if (url) urls.push(url);
  }

  return urls;
}

/**
 * מעלה תמונת גלריה ומחזיר את הנתיב שלה (לא קישור) - הקישור נחתם בשרת
 * רק לצופה מורשה. null אם ההעלאה נכשלה.
 */
export async function uploadStudentPhoto(
  supabase: BrowserSupabaseClient,
  studentId: string,
  file: File,
): Promise<string | null> {
  const extension = fileExtension(file, DEFAULT_PHOTO_EXTENSION);
  const path = `${studentId}/photos/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  return (await uploadToStudentsBucket(supabase, path, file)) ? path : null;
}

export type SaveStudentPhotosResult = {
  /** כמה תמונות חדשות לא הועלו (ולכן לא נשמרו) */
  failedUploads: number;
  /** שגיאת שמירת הגלריה עצמה, או null */
  error: string | null;
};

/**
 * שומר את הגלריה לפי סדר הפריטים: מעלה את החדשות, מחליף את הרשימה ב-
 * set_student_photos ומוחק מהאחסון את מה שהוסר. תמונה שנכשלה בהעלאה
 * מדולגת, ושאר הגלריה נשמרת.
 */
export async function saveStudentPhotos(
  supabase: BrowserSupabaseClient,
  studentId: string,
  items: readonly StudentPhotoItem[],
): Promise<SaveStudentPhotosResult> {
  const paths: string[] = [];
  const uploadedPaths: string[] = [];
  let failedUploads = 0;

  for (const item of items) {
    if (item.kind === "existing") {
      // תמונה חסויה לעורך מגיעה בלי נתיב - היא אינה בידיו לשמור או להסיר
      if (item.path) paths.push(item.path);
      continue;
    }
    const path = await uploadStudentPhoto(supabase, studentId, item.file);
    if (path) {
      paths.push(path);
      uploadedPaths.push(path);
    } else {
      failedUploads += 1;
    }
  }

  const { data: removed, error } = await supabase.rpc("set_student_photos", {
    p_student_id: studentId,
    p_paths: paths,
  });

  if (error) {
    console.error("[students/photos] set_student_photos failed:", error);
    // הקבצים שהועלו עכשיו לא נרשמו בגלריה - מנקים אותם כדי שלא יישארו יתומים
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(STUDENT_PHOTOS_BUCKET).remove(uploadedPaths);
    }
    return { failedUploads, error: error.hint || error.message };
  }

  const removedPaths = Array.isArray(removed)
    ? removed.filter((path): path is string => typeof path === "string")
    : [];

  if (removedPaths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .remove(removedPaths);
    // מדיניות האחסון מתירה מחיקה רק לבעל הכרטיס; אצל שדכן הקובץ נשאר, אבל
    // כבר אינו חלק מהגלריה ואינו מוצג
    if (removeError) {
      console.warn("[students/photos] storage remove failed:", removeError);
    }
  }

  return { failedUploads, error: null };
}
