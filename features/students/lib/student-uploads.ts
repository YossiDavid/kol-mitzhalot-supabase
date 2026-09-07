import type { createClient } from "@/lib/supabase/client";

// העלאת קבצי כרטיס (תמונה, קו״ח, מסמכים רפואיים) ל-Storage. משותף ליצירה
// ולעריכה — שני המסלולים שומרים לאותו bucket ובאותה מוסכמת נתיבים.

type BrowserSupabaseClient = ReturnType<typeof createClient>;

export type StudentFileKind = "image" | "cv" | "medical";

const STUDENTS_BUCKET = "students";
/** תוקף ה-signed URL: שנה. Public URL אינו אפשרי כי ה-bucket פרטי. */
const SIGNED_URL_TTL_SECONDS = 31536000;
const MAX_FILE_NAME_LENGTH = 100;

const DEFAULT_EXTENSION: Record<Exclude<StudentFileKind, "medical">, string> = {
  image: "jpg",
  cv: "pdf",
};

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
      .replace(/[\u0590-\u05FF]/g, "")
      .replace(/[^a-zA-Z0-9\-_]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, MAX_FILE_NAME_LENGTH) || "file";

  return sanitized + ext;
}

function buildStoragePath(
  studentId: string,
  file: File,
  kind: StudentFileKind,
): string {
  const sanitized = sanitizeFileName(file.name);
  if (kind === "medical") {
    return `${studentId}/medical/${Date.now()}-${sanitized}`;
  }
  const extension = sanitized.split(".").pop() || DEFAULT_EXTENSION[kind];
  return `${studentId}/${Date.now()}-${kind}.${extension}`;
}

/**
 * מעלה קובץ בודד ומחזיר signed URL, או null אם ההעלאה נכשלה. כישלון אינו
 * זורק: כרטיס עם קובץ חסר עדיף על שמירה שנפלה כולה, והמשתמש יוכל להעלות שוב.
 */
export async function uploadStudentFile(
  supabase: BrowserSupabaseClient,
  studentId: string,
  file: File,
  kind: StudentFileKind,
): Promise<string | null> {
  const path = buildStoragePath(studentId, file, kind);

  const { error: uploadError } = await supabase.storage
    .from(STUDENTS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    console.error("Error uploading student file:", kind, uploadError);
    return null;
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(STUDENTS_BUCKET)
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
