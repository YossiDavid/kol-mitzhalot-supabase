/**
 * תמונת השדכן ב-bucket הפרטי shadchan-avatars. משותף ללקוח (העלאה מהטופס)
 * ולשרת (חתימה). ההגבלות זהות ל-bucket ול-CHECK שב-
 * supabase/migrations/20261029110000_shadchan_gender_birth_avatar.sql.
 */

export const SHADCHAN_AVATARS_BUCKET = "shadchan-avatars";

/** 5MB - כמו file_size_limit של ה-bucket */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const AVATAR_ACCEPT = Object.keys(EXTENSION_BY_MIME).join(",");

/** הודעת שגיאה לקובץ שאינו מתאים, או null כשהוא תקין */
export function validateAvatarFile(file: File): string | null {
  if (!(file.type in EXTENSION_BY_MIME)) {
    return "ניתן להעלות תמונה מסוג JPG, PNG או WEBP בלבד";
  }
  if (file.size > AVATAR_MAX_BYTES) return "התמונה גדולה מדי (עד 5MB)";
  return null;
}

/** נתיב חדש בתיקייה של בעל הפרופיל - שם ייחודי, כדי שלא יוגש עותק ישן מהמטמון */
export function buildAvatarPath(ownerId: string, file: File): string {
  const extension = EXTENSION_BY_MIME[file.type] ?? "jpg";
  return `${ownerId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

/**
 * avatar_url מה-RPC הציבורי הוא אחד משניים: נתיב ב-bucket (צריך חתימה), או
 * קישור מלא ישן מהמטא-דאטה של המשתמש (מוצג כמו שהוא).
 */
export function isAvatarStoragePath(value: string): boolean {
  return !/^https?:\/\//i.test(value);
}
