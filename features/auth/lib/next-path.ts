/**
 * יעד ההפניה אחרי התחברות ("next").
 *
 * הערך מגיע תמיד ממקור שהמשתמש שולט בו — ה-query של דף ההתחברות, או הנתיב
 * שנשלח בקישור ההתחברות במייל — ולכן הוא חייב להיות מסונן לפני שמפנים אליו.
 * בלי הסינון, ערך כמו "https://evil.example" או "//evil.example" היה הופך את
 * מסך ההתחברות שלנו למגשר open redirect.
 *
 * הערך המוחזר מסומן כ-`Route` (typedRoutes פעיל ב-next.config): אלה נתיבים
 * שנבנים בזמן ריצה ואי אפשר לאמת אותם מול רשימת הנתיבים בזמן הידור, והסינון
 * כאן הוא מה שמחליף את האימות הזה.
 */
import type { Route } from "next";

/** היעד כשאין "next" תקין */
export const DEFAULT_NEXT_PATH = "/app" as Route;

/** הקוד הגבוה ביותר שנחשב תו בקרה בתחילת טבלת ASCII */
const LAST_CONTROL_CHAR_CODE = 0x1f;
/** DEL — תו בקרה בודד מעל התווים הניתנים להדפסה */
const DELETE_CHAR_CODE = 0x7f;

/**
 * תווי בקרה בנתיב הם ניסיון הזרקה לכותרת Location. הבדיקה נעשית על קודי
 * התווים ולא ב-regex, כדי שהקוד לא יישען על רצפי escape שקל לשבש בעריכה.
 */
function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= LAST_CONTROL_CHAR_CODE || code === DELETE_CHAR_CODE) {
      return true;
    }
  }
  return false;
}

/**
 * מחזיר נתיב פנימי בטוח להפניה, או `DEFAULT_NEXT_PATH` כשהערך אינו כזה.
 *
 * מותר רק נתיב שמתחיל בלוכסן יחיד. "//host" הוא כתובת protocol-relative,
 * ולוכסן הפוך אחרי הלוכסן מתפרש בחלק מהדפדפנים באותו אופן — שניהם מוציאים
 * את המשתמש אל מחוץ לאתר.
 */
export function sanitizeNextPath(raw: string | null | undefined): Route {
  if (!raw) return DEFAULT_NEXT_PATH;
  if (!raw.startsWith("/")) return DEFAULT_NEXT_PATH;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_NEXT_PATH;
  if (hasControlChars(raw)) return DEFAULT_NEXT_PATH;
  return raw as Route;
}

/**
 * מוסיף `?next=` לנתיב פנימי. יעד ברירת המחדל לא נוסף בכלל, כדי שכתובות
 * ההתחברות הרגילות יישארו נקיות.
 */
export function withNextParam(
  path: Route,
  next: string | null | undefined,
): Route {
  const safe = sanitizeNextPath(next);
  if (safe === DEFAULT_NEXT_PATH) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(safe)}` as Route;
}
