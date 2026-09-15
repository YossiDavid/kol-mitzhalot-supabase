/**
 * פריסת השדות בטופס המיועדים (docs/design-refactor/PLAN.md, שלב 1).
 *
 * שדה מגדיר רוחב סמנטי (`width`), והמקום היחיד שמתרגם אותו למחלקות הוא כאן.
 * הרשת מגיבה לרוחב המקטע עצמו (container query) ולא לרוחב המסך: סרגל הצד של
 * האפליקציה, ניווט השלבים וכרטיס של רשומה חוזרת משנים את הרוחב שבאמת זמין.
 *
 * | רוחב המקטע     | sm    | md    | lg    | full |
 * |----------------|-------|-------|-------|------|
 * | מתחת ל-544px   | מלא   | מלא   | מלא   | מלא  |
 * | 544px-863px    | חצי   | חצי   | מלא   | מלא  |
 * | 864px ומעלה    | רבע   | שליש  | חצי   | מלא  |
 *
 * 864px נבחר כך ששדה שם עם תוארים (lg) משאיר לשם עצמו לפחות 200px, ושדה sm
 * לא יורד מ-160px.
 */
export type FieldWidth = "sm" | "md" | "lg" | "full";

/** הרשת של מקטע ושל כרטיס ברשומה חוזרת */
export const FIELD_GRID_CLASS = "@container grid grid-cols-12 gap-x-5 gap-y-6";

const FIELD_WIDTH_CLASS: Record<FieldWidth, string> = {
  sm: "col-span-12 @min-[34rem]:col-span-6 @min-[54rem]:col-span-3",
  md: "col-span-12 @min-[34rem]:col-span-6 @min-[54rem]:col-span-4",
  lg: "col-span-12 @min-[54rem]:col-span-6",
  full: "col-span-12",
};

function isFieldWidth(width: unknown): width is FieldWidth {
  return typeof width === "string" && width in FIELD_WIDTH_CLASS;
}

/** שדה בלי width (או עם ערך לא מוכר) תופס את כל השורה */
export function getFieldWidthClass(width?: unknown): string {
  return isFieldWidth(width)
    ? FIELD_WIDTH_CLASS[width]
    : FIELD_WIDTH_CLASS.full;
}

/**
 * שורה צפופה של פריט ברשימה שבתוך כרטיס (ילדים מנישואים קודמים): כל הפריט
 * בשורה אחת כשיש מקום, ובערימה כשאין. אותם רוחבות סמנטיים, בסולם משלה:
 *
 * | רוחב השורה   | sm   | md   | lg   | full | כפתור פעולה |
 * |--------------|------|------|------|------|-------------|
 * | מתחת ל-704px | חצי  | מלא  | מלא  | מלא  | חצי         |
 * | 704px ומעלה  | 2/12 | 3/12 | 6/12 | מלא  | 1/12        |
 *
 * 704px: שלושה שדות md, שדה sm וכפתור מחיקה נכנסים בשורה, והתאריך לא יורד
 * מ-160px.
 */
export const COMPACT_ROW_GRID_CLASS =
  "@container grid grid-cols-12 items-start gap-x-4 gap-y-4";

const COMPACT_FIELD_WIDTH_CLASS: Record<FieldWidth, string> = {
  sm: "col-span-6 @min-[44rem]:col-span-2",
  md: "col-span-12 @min-[44rem]:col-span-3",
  lg: "col-span-12 @min-[44rem]:col-span-6",
  full: "col-span-12",
};

export function getCompactFieldWidthClass(width?: unknown): string {
  return isFieldWidth(width)
    ? COMPACT_FIELD_WIDTH_CLASS[width]
    : COMPACT_FIELD_WIDTH_CLASS.full;
}

/** תא הכפתור בסוף שורה צפופה (למשל מחיקת הפריט) */
export const COMPACT_ROW_ACTION_CLASS = "col-span-6 @min-[44rem]:col-span-1";

/** שורה מלאה ברשת, למשל טקסט שמופיע לפני קבוצת שדות */
export const FULL_ROW_CLASS = FIELD_WIDTH_CLASS.full;

/**
 * כל תא של שדה מסומן בשם השדה, כדי שאחרי ולידציה שנכשלה אפשר יהיה למצוא את
 * השדה השגוי הראשון לפי סדר התצוגה (features/students/lib/focus-first-invalid-field.ts).
 */
export const FIELD_NAME_ATTRIBUTE = "data-field-name";

export function fieldCellAttributes(name: string): Record<string, string> {
  return { [FIELD_NAME_ATTRIBUTE]: name };
}

/** השדה נגלל אל מתחת לכותרת הדביקה של האפליקציה (h-16) ולא נחבא מאחוריה */
export const FIELD_SCROLL_MARGIN_CLASS = "scroll-mt-24";
