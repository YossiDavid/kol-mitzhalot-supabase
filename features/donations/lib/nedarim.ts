/**
 * הגדרות וכללים משותפים לתרומה דרך ה-iframe של נדרים פלוס (שיטה 3).
 * אין מפתח API בצד הלקוח: נדרש רק מספר המוסד וטקסט האימות של העמוד (ApiValid),
 * ושניהם ציבוריים. הקובץ טהור (ללא תלויות) כדי שאפשר יהיה לבדוק אותו ישירות.
 */

/** מספר מוסד בנדרים פלוס: 7 ספרות בדיוק */
const MOSAD_ID_PATTERN = /^\d{7}$/;

/** אורך סביר לטקסט האימות; ערך ארוך מזה מעיד על הדבקה שגויה (למשל מפתח ה-API) */
export const API_VALID_MAX_LENGTH = 100;

/** גבולות סכום התרומה בשקלים */
export const DONATION_AMOUNT_MIN = 10;
export const DONATION_AMOUNT_MAX = 50_000;

/** מגבלות אורך לטקסט חופשי */
export const DONOR_NAME_MAX_LENGTH = 60;
export const DEDICATION_NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 100;

export const DONATION_GROUP = "תרומה";
export const DEDICATION_GROUP = "הנצחה";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** השרת של הספק דוחה הערות עם קישורים או תגיות; בודקים מראש כדי להציג שגיאה בטופס */
const FORBIDDEN_COMMENT_PATTERN = /http|www|<img|src=/i;

export type DonationFrequency = "once" | "monthly";

export interface NedarimConfig {
  mosadId: string;
  apiValid: string;
}

/** מחזיר את מספר המוסד רק אם הוא תקין, אחרת null */
export function resolveNedarimMosadId(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim() ?? "";
  return MOSAD_ID_PATTERN.test(value) ? value : null;
}

/** מחזיר את טקסט האימות רק אם הוא לא ריק ובאורך סביר, אחרת null */
export function resolveNedarimApiValid(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim() ?? "";
  return value && value.length <= API_VALID_MAX_LENGTH ? value : null;
}

/** ההגדרה המלאה, או null כשאחד משני הערכים חסר או לא תקין (מוצג fallback) */
export function resolveNedarimConfig(env: {
  mosadId: string | null | undefined;
  apiValid: string | null | undefined;
}): NedarimConfig | null {
  const mosadId = resolveNedarimMosadId(env.mosadId);
  const apiValid = resolveNedarimApiValid(env.apiValid);
  return mosadId && apiValid ? { mosadId, apiValid } : null;
}

export function isValidDonationAmount(amount: number): boolean {
  return (
    Number.isInteger(amount) &&
    amount >= DONATION_AMOUNT_MIN &&
    amount <= DONATION_AMOUNT_MAX
  );
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value) && value.length <= EMAIL_MAX_LENGTH;
}

export function containsForbiddenLink(text: string): boolean {
  return FORBIDDEN_COMMENT_PATTERN.test(text);
}
