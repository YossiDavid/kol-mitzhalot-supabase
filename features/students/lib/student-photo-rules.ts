/**
 * חוקי גלריית התמונות של מיועד - משותף לטופס (לקוח), להעלאה ולשרת.
 * ראה supabase/migrations/20260916100000_student_photo_gallery.sql
 */

export const STUDENT_PHOTOS_BUCKET = "students";

/** זהה ל-c_max_photos ב-set_student_photos */
export const MAX_STUDENT_PHOTOS = 6;

const BYTES_PER_MB = 1024 * 1024;

/** הגודל המרבי של תמונה שנשמרת - אחרי ההקטנה בדפדפן */
export const MAX_STUDENT_PHOTO_MB = 1;
export const MAX_STUDENT_PHOTO_BYTES = MAX_STUDENT_PHOTO_MB * BYTES_PER_MB;

/**
 * הגודל המרבי של הקובץ שנבחר, לפני ההקטנה. תמונת טלפון רגילה היא 3-8MB,
 * ולכן המגבלה כאן נדיבה - מה שנשמר בפועל קטן תמיד מ-MAX_STUDENT_PHOTO_MB.
 */
export const MAX_SOURCE_PHOTO_MB = 20;
const MAX_SOURCE_PHOTO_BYTES = MAX_SOURCE_PHOTO_MB * BYTES_PER_MB;

/** הצלע הארוכה של תמונה שנשמרת - מספיק לתצוגה במסך מלא */
export const MAX_PHOTO_DIMENSION_PX = 1600;

export const ACCEPTED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/**
 * הקישור החתום נוצר מחדש בכל טעינת עמוד, ולכן תוקף קצר מספיק - ואינו
 * משאיר כתובת שממשיכה לעבוד חודשים אחרי שההרשאה בוטלה.
 */
export const SIGNED_PHOTO_URL_TTL_SECONDS = 60 * 60;

/**
 * פריט בגלריה שבטופס, לפי הסדר (הראשון = התמונה הראשית):
 * - existing: תמונה שכבר שמורה. כשהעורך אינו רשאי לראות אותה (בת, בלי
 *   אישור צפייה) גם url וגם path ריקים - לא נשלח לדפדפן אפילו הנתיב, והיא
 *   אינה ניתנת להסרה (set_student_photos דוחה עורך כזה ממילא).
 * - new: קובץ שנבחר עכשיו - כבר אחרי ההקטנה - וטרם הועלה.
 */
export type StudentPhotoItem =
  | { kind: "existing"; path: string; url: string | null }
  | { kind: "new"; id: string; file: File };

/** בודק את הקובץ שנבחר (לפני ההקטנה). הודעת שגיאה בעברית, או null אם תקין */
export function validatePhotoFile(file: File): string | null {
  if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return `הקובץ ${file.name} אינו תמונה נתמכת (JPG, PNG או WebP)`;
  }
  if (file.size > MAX_SOURCE_PHOTO_BYTES) {
    return `התמונה ${file.name} גדולה מ-${MAX_SOURCE_PHOTO_MB}MB`;
  }
  return null;
}
