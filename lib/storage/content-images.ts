import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * תמונות ב-bucket הציבורי `content` (מיגרציה website_content_and_forms).
 * הקבועים חייבים להישאר תואמים למגבלות ה-bucket: סוגי הקבצים והגודל נאכפים
 * בשרת, ושם ההודעה באנגלית. הבדיקה כאן מקדימה אותה בהודעה בעברית.
 */
export const CONTENT_BUCKET = "content";
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const BYTES_PER_MB = 1024 * 1024;

/** הודעת שגיאה בעברית, או null כשהקובץ תקין */
export function validateContentImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "ניתן להעלות תמונה בלבד (JPG, PNG, WEBP או GIF). קובץ PDF או HEIC יש להמיר לתמונה לפני ההעלאה.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const sizeMb = (file.size / BYTES_PER_MB).toFixed(1);
    return `הקובץ שנבחר שוקל ${sizeMb}MB, והמגבלה היא ${MAX_IMAGE_MB}MB. יש להקטין את התמונה ולנסות שוב.`;
  }
  return null;
}

/** מעלה תמונה לתיקייה ב-bucket ומחזיר את הכתובת הציבורית שלה */
export async function uploadContentImage(
  supabase: SupabaseClient,
  file: File,
  folder: string,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(CONTENT_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw new Error(error.message);
  return supabase.storage.from(CONTENT_BUCKET).getPublicUrl(path).data
    .publicUrl;
}
