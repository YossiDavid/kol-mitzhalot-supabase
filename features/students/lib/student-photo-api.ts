/**
 * החוזה בין טבלת המיועדים (לקוח) לנקודות הקצה של התמונות (שרת).
 * ראה app/api/v1/students/photos/thumbnails ו-app/api/v1/students/[studentId]/photos
 */

import { SIGNED_PHOTO_URL_TTL_SECONDS } from "@/features/students/lib/student-photo-rules";

/**
 * התמונה הראשית של שורה בטבלה:
 * - ok: הצופה רשאי לראות - קישור חתום קצר-מועד.
 * - locked: יש תמונות, אבל הצופה אינו רשאי לראותן. אין קישור ואין נתיב.
 * - none: אין תמונה (או שהקובץ חסר באחסון).
 */
export type StudentThumbnail =
  | { status: "ok"; url: string }
  | { status: "locked" }
  | { status: "none" };

export type StudentThumbnailsRequest = { studentIds: string[] };

/** כרטיס שהצופה אינו רשאי לראות בכלל (RLS) פשוט אינו מופיע בתשובה */
export type StudentThumbnailsResponse = {
  thumbnails: Record<string, StudentThumbnail>;
};

export type StudentGalleryResponse = { photos: { url: string }[] };

/** כמה כרטיסים בבקשה אחת. רשימה ארוכה יותר נשלחת בכמה בקשות במקביל */
export const MAX_THUMBNAIL_BATCH = 200;

export const STUDENT_THUMBNAILS_ENDPOINT = "/api/v1/students/photos/thumbnails";

export function studentGalleryEndpoint(studentId: string) {
  return `/api/v1/students/${studentId}/photos`;
}

const MS_PER_SECOND = 1000;
/** מרווח ביטחון: קישור שעומד לפוג בקרוב נחשב פג, כדי שלא יפוג באמצע צפייה */
const URL_EXPIRY_MARGIN_MS = 5 * 60 * MS_PER_SECOND;

/** כמה זמן קישור שהתקבל מהשרת נחשב תקף בלקוח */
export const SIGNED_URL_CLIENT_LIFETIME_MS =
  SIGNED_PHOTO_URL_TTL_SECONDS * MS_PER_SECOND - URL_EXPIRY_MARGIN_MS;

export const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
