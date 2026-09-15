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

/** שדה בלי width (או עם ערך לא מוכר) תופס את כל השורה */
export function getFieldWidthClass(width?: unknown): string {
  if (typeof width === "string" && width in FIELD_WIDTH_CLASS) {
    return FIELD_WIDTH_CLASS[width as FieldWidth];
  }
  return FIELD_WIDTH_CLASS.full;
}

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
