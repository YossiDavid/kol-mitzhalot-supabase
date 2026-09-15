/**
 * סולם הגבהים של רכיבי קלט ופעולה: שדה טקסט, רשימה נפתחת, שדה חיפוש וכפתור
 * לוקחים את הגובה מכאן, כדי שיתיישרו באותה שורה. במובייל גבוה יותר, למגע
 * (44px). ראה docs/design-refactor/PLAN.md, שלב 0.
 */
export const CONTROL_HEIGHT = {
  sm: "h-9 md:h-8",
  default: "h-11 md:h-10",
  lg: "h-12",
} as const;

/** אותו סולם לכפתורי אייקון מרובעים */
export const CONTROL_SQUARE = {
  sm: "size-9 md:size-8",
  default: "size-11 md:size-10",
  lg: "size-12",
} as const;

export type ControlSize = keyof typeof CONTROL_HEIGHT;
