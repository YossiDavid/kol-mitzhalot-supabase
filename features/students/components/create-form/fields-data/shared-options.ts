import {
  LANGUAGE_NAMES,
  OTHER_LANGUAGE,
} from "@/features/students/lib/student-languages";
import type { FieldCondition } from "../field-visibility";
import type {
  FieldOptionDefinition,
  TextAndSelectField,
  UploadField,
} from "./types";

// אפשרויות ותנאים שחוזרים בכמה שלבים - מוגדרים פעם אחת

type TitlesConfig = Pick<
  TextAndSelectField,
  "prefixOptions" | "prefixPlaceholder" | "placeholder" | "options"
>;

function sameValueAndLabel(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

/** שם של גבר (אב, סבא): תואר לפני ואחרי השם */
export const MALE_NAME_TITLES: TitlesConfig = {
  prefixOptions: sameValueAndLabel(["הרב", "הר״ר", "הרה״ח", "הרה״ג", "הרה״צ"]),
  prefixPlaceholder: "תואר לפני",
  placeholder: "תואר אחרי",
  options: sameValueAndLabel(["הי״ו", "שליט״א", "ז״ל", "זצ״ל", "זצוק״ל"]),
};

/** שם של אשה (אם, סבתא): תואר לפני ואחרי השם */
export const FEMALE_NAME_TITLES: TitlesConfig = {
  prefixOptions: sameValueAndLabel(["הגב׳", "הרבנית"]),
  prefixPlaceholder: "תואר לפני",
  placeholder: "תואר אחרי",
  options: sameValueAndLabel(["תחי׳", "תליט״א", "ע״ה"]),
};

/** סוג טלפון - של המיועד/ת ושל מי שמחפשים (cellphone_type_enum) */
export const CELLPHONE_TYPE_OPTIONS: FieldOptionDefinition[] = [
  { value: "kosher", label: "כשר" },
  { value: "sms", label: "SMS" },
  { value: "protected_smartphone", label: "סמארטפון מוגן" },
  { value: "other", label: "אחר" },
];

const HEAD_COVER_BASE_OPTIONS: FieldOptionDefinition[] = [
  { value: "kerchief", label: "מטפחת" },
  { value: "wig", label: "פאה" },
  { value: "wig_and_hat", label: "פאה וכובע" },
  { value: "wig_and_band", label: "פאה ובנד" },
];

/**
 * סוג כיסוי ראש (head_cover_type). הערך "other" משמעותו שונה לפי ההקשר,
 * ולכן גם התווית (כך גם בתצוגה - headCoverTypeToHebrew):
 * בכרטיס המיועדת - "גמיש" (תתאים את עצמה); בהעדפת המיועד - "לא משנה".
 */
export const HEAD_COVER_TYPE_OPTIONS: FieldOptionDefinition[] = [
  ...HEAD_COVER_BASE_OPTIONS,
  { value: "other", label: "גמיש - פתוחה לכל אחת מהאפשרויות" },
];

export const PARTNER_HEAD_COVER_TYPE_OPTIONS: FieldOptionDefinition[] = [
  ...HEAD_COVER_BASE_OPTIONS,
  { value: "other", label: "לא משנה" },
];

/** "מתעתד בעז״ה" - של המיועד ושל מי שמחפשים (plan_for_life_enum) */
export const PLAN_FOR_LIFE_OPTIONS: FieldOptionDefinition[] = [
  { value: "koilel", label: "ללמוד בכולל" },
  { value: "torah_job", label: "לעבוד בעבודה תורנית" },
  { value: "mix_torah_work", label: "לשלב תורה ועבודה" },
  { value: "work", label: "לעבוד" },
];

/**
 * מגבלת השליפה של מאגר הקהילות: גבוהה מגודל המאגר, כדי שהרשימה כולה
 * תיפתח (ברירת המחדל של הבורר היא 50). תואם למגבלת התשובה של PostgREST.
 */
const COMMUNITY_CATALOG_LIMIT = 1000;

/**
 * בורר "חסידות או קהילה" מתוך מאגר הקהילות (public.communities).
 * הערך הנשמר הוא השם עצמו ולא מזהה, ולכן כרטיסים שהוזנו כטקסט חופשי
 * נשארים תקפים. ערך שאינו במאגר מוצע להוספה (creatable). הרשימה נפתחת
 * כולה, לפי סדר הא"ב.
 */
export const COMMUNITY_SEARCH = {
  table: "communities",
  valueColumn: "name",
  labelColumn: "name",
  searchColumn: "name",
  filters: { is_active: true },
  orderColumn: "name",
  limit: COMMUNITY_CATALOG_LIMIT,
  creatable: true,
  placeholder: "חיפוש או הוספה למאגר",
  empty: "לא נמצאה קהילה בשם הזה",
} as const;

/**
 * "מוכן/ה לגור ב:" - ארצות לבחירה מרובה. הערך הנשמר הוא שם הארץ עצמו
 * (students.willing_to_live_countries), כמו בשדה "ארץ" של הכרטיס.
 */
export const WILLING_TO_LIVE_COUNTRY_OPTIONS: FieldOptionDefinition[] =
  sameValueAndLabel([
    "ישראל",
    "ארצות הברית",
    "אנגליה",
    "בלגיה",
    "צרפת",
    "שווייץ",
    "אוסטריה",
    "קנדה",
    "ארגנטינה",
    "מקסיקו",
    "ברזיל",
    "אוסטרליה",
    "דרום אפריקה",
  ]);

/**
 * "שפת אם" ו"שפות נוספות" (student-languages.ts). "אחר" בסוף הרשימה, ופותח
 * שדה טקסט לשפה שאינה ברשימה.
 */
export const LANGUAGE_OPTIONS: FieldOptionDefinition[] = sameValueAndLabel([
  ...LANGUAGE_NAMES,
  OTHER_LANGUAGE,
]);

/** קבצים שמתקבלים בקו״ח ובמסמכים רפואיים */
export const DOCUMENT_ACCEPT: UploadField["accept"] = {
  "application/pdf": [".pdf"],
  "image/*": [".png", ".jpg", ".jpeg"],
};

/** מוצג רק למיועד או רק למיועדת */
export function genderIs(gender: "male" | "female"): FieldCondition[] {
  return [{ parameter: "gender", operator: "===", value: gender }];
}
