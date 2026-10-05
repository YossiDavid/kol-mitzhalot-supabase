/**
 * המרת ערכי הטופס לאובייקט ה-Value של הודעת StartPayment ל-iframe של נדרים פלוס.
 * טהור, ללא React. כל הערכים מחרוזות, ושדות אופציונליים ריקים מושמטים.
 * לא שולחים Param1 (מסתיר ביט והעברה בנקאית). Param2 הוא ה-id שהשרת הנפיק, ו-CallBack
 * (כתובת ה-webhook של השרת) נשלח רק כשהשרת החזיר כזו.
 */
import { isValidPhone, normalizePhoneKey } from "@/lib/phone";
import {
  DEDICATION_GROUP,
  DONATION_GROUP,
  DONOR_NAME_MAX_LENGTH,
  containsForbiddenLink,
  isValidDonationAmount,
  isValidEmail,
  type DonationFrequency,
} from "./nedarim";

export const COMMENT_MAX_LENGTH = 300;
const BUTTON_TEXT = "תרומה";
const CURRENCY_SHEKEL = "1";
const IL_INTL_MOBILE = /^9725\d{8}$/;

export type StartPaymentValue = Record<string, string>;

export interface StartPaymentInput {
  mosadId: string;
  apiValid: string;
  /** סכום בשקלים (לחודש בהוראת קבע) */
  amount: number;
  frequency: DonationFrequency;
  /** טקסט ההקדשה המלא, למשל "לעילוי נשמת משה בן שרה" */
  dedication?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  /** מזהה הכוונה מהשרת (Param2); ברירת מחדל UUID חדש (בדיקות) */
  createId?: () => string;
  /** כתובת ה-CallBack מהשרת; null/חסר = משמיטים (למשל ב-localhost) */
  callBack?: string | null;
}

const clean = (value: string | undefined, maxLength: number) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);

/** טלפון תקין בלבד, בספרות; קידומת 972 מומרת ל-05 כפי שביט דורש */
function toProviderPhone(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value || !isValidPhone(value)) return "";
  const digits = normalizePhoneKey(value);
  return IL_INTL_MOBILE.test(digits) ? `0${digits.slice(3)}` : digits;
}

/**
 * מחזיר את ה-Value, או null כשהסכום לא תקין או שההקדשה כוללת קישור/תגית
 * (הטופס מציג שגיאה לפני כן, והבדיקה כאן היא רשת ביטחון).
 */
export function buildStartPaymentValue(
  input: StartPaymentInput,
): StartPaymentValue | null {
  if (!isValidDonationAmount(input.amount)) return null;

  const comment = clean(input.dedication, COMMENT_MAX_LENGTH);
  if (containsForbiddenLink(comment)) return null;

  const isMonthly = input.frequency === "monthly";
  const email = clean(input.email, 200);
  const optional: StartPaymentValue = {
    FirstName: clean(input.firstName, DONOR_NAME_MAX_LENGTH),
    LastName: clean(input.lastName, DONOR_NAME_MAX_LENGTH),
    Phone: toProviderPhone(input.phone),
    Mail: isValidEmail(email) ? email : "",
    Comment: comment,
  };
  const presentOptional = Object.fromEntries(
    Object.entries(optional).filter(([, value]) => value !== ""),
  );

  return {
    Mosad: input.mosadId,
    ApiValid: input.apiValid,
    Amount: String(input.amount),
    PaymentType: isMonthly ? "HK" : "Ragil",
    Currency: CURRENCY_SHEKEL,
    // חד-פעמי: תשלום אחד; הוראת קבע: ריק = ללא הגבלה
    Tashlumim: isMonthly ? "" : "1",
    Groupe: comment ? DEDICATION_GROUP : DONATION_GROUP,
    Param2: (input.createId ?? (() => crypto.randomUUID()))(),
    ButtonText: BUTTON_TEXT,
    ...(input.callBack ? { CallBack: input.callBack } : {}),
    ...presentOptional,
  };
}
