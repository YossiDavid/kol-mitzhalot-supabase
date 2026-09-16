/**
 * אבני הבניין של סכמות zod לטפסים (docs/design-refactor/PLAN.md, שלב 3).
 *
 * כל שדה בטופס מוגדר כאן פעם אחת יחד עם הודעת השגיאה שלו, כדי שנוסח
 * "נא למלא <תווית>" / "נא לבחור <תווית>", בדיקת האימייל ובדיקת הטלפון יהיו
 * זהים בכל הטפסים ולא ייכתבו מחדש בכל עמוד.
 *
 *   const schema = z.object({
 *     firstName: requiredText("שם פרטי"),
 *     email: requiredEmail("אימייל"),
 *     phone: optionalPhone(),
 *   });
 */

import { z } from "zod";

import { isValidPhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import { chooseMessage, fillMessage } from "./field-messages";

/** אותו ביטוי שהיה בטפסים לפני האיחוד (פרופיל, בקשת שדכן) */
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export const EMAIL_INVALID_MESSAGE = "אימייל לא תקין";

const WHOLE_NUMBER_PATTERN = /^\d+$/;

export const WHOLE_NUMBER_INVALID_MESSAGE = "נא להזין מספר שלם לא שלילי";

/** שדה טקסט רשות. `.trim()` כדי שרווחים בלבד לא ייחשבו ערך */
export function optionalText() {
  return z.string().trim();
}

/** שדה הקלדה חובה: "נא למלא <תווית>" */
export function requiredText(label: string) {
  return z.string().trim().min(1, fillMessage(label));
}

/** שדה בחירה חובה (רשימה נפתחת, רדיו, תאריך): "נא לבחור <תווית>" */
export function requiredChoice(label: string) {
  return z.string().trim().min(1, chooseMessage(label));
}

/** אימייל חובה */
export function requiredEmail(label: string) {
  return requiredText(label).regex(EMAIL_PATTERN, EMAIL_INVALID_MESSAGE);
}

/** אימייל רשות: ריק מותר, ערך שהוזן חייב להיות תקין */
export function optionalEmail() {
  return optionalText().refine(
    (value) => !value || EMAIL_PATTERN.test(value),
    EMAIL_INVALID_MESSAGE,
  );
}

/** טלפון חובה, לפי אותה בדיקה שבכל המערכת (lib/phone.ts) */
export function requiredPhone(label: string) {
  return requiredText(label).refine(isValidPhone, PHONE_INVALID_MESSAGE);
}

/** טלפון רשות: ריק מותר, ערך שהוזן חייב להיות תקין */
export function optionalPhone() {
  return optionalText().refine(
    (value) => !value || isValidPhone(value),
    PHONE_INVALID_MESSAGE,
  );
}

/**
 * מספר שלם לא שלילי שנשמר כטקסט (הפקד הוא `type="number"`, והערך שלו
 * מחרוזת). ריק נחסם עם נוסח השדה החובה הרגיל.
 */
export function requiredWholeNumber(label: string) {
  return requiredText(label).regex(
    WHOLE_NUMBER_PATTERN,
    WHOLE_NUMBER_INVALID_MESSAGE,
  );
}

/** מספר שלם לא שלילי כטקסט, רשות */
export function optionalWholeNumber() {
  return optionalText().refine(
    (value) => !value || WHOLE_NUMBER_PATTERN.test(value),
    WHOLE_NUMBER_INVALID_MESSAGE,
  );
}
