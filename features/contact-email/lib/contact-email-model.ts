/**
 * "אימייל ליצירת קשר" של המערכת: הגדרה ב-system_settings (עמודת text_value)
 * שמוצגת בתחתית כל דף. הקובץ טהור, ומשותף לשרת (קריאה וכתיבה) ולטופס.
 */
import { z } from "zod";

import { EMAIL_INVALID_MESSAGE, EMAIL_PATTERN } from "@/lib/forms/schema";

/** מפתח השורה ב-system_settings; זהה למפתח שהפונקציה get_contact_email קוראת */
export const CONTACT_EMAIL_SETTING_KEY = "contact_email";

/** תג הקאש של הערך; פעולת המנהל מפקיעה אותו אחרי כל שינוי */
export const CONTACT_EMAIL_CACHE_TAG = "contact-email";

/** אורך מקסימלי של כתובת אימייל (RFC 5321); זהה למגבלה בטבלה */
export const CONTACT_EMAIL_MAX_LENGTH = 254;

/** ריק = ההגדרה מנוקה והתחתית לא מציגה שורה */
export const contactEmailSchema = z
  .string()
  .trim()
  .max(CONTACT_EMAIL_MAX_LENGTH, `עד ${CONTACT_EMAIL_MAX_LENGTH} תווים`)
  .refine(
    (value) => !value || EMAIL_PATTERN.test(value),
    EMAIL_INVALID_MESSAGE,
  );

export const CONTACT_EMAIL_MESSAGES = {
  forbidden: "אין הרשאה לבצע את הפעולה",
  invalid: "כתובת האימייל אינה תקינה",
  saveFailed: "השמירה נכשלה. נסו שוב",
  saved: "האימייל נשמר",
  cleared: "האימייל הוסר מהתחתית",
} as const;
