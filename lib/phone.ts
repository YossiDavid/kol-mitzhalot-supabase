const IL_LOCAL_REGEX = /^05\d{8}$/;
const IL_INTL_REGEX = /^9725\d{8}$/;
const IL_PLUS_REGEX = /^\+9725\d{8}$/;

/** E.164 allows up to 15 digits; minimum for a reachable number */
const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15;

export const PHONE_INVALID_MESSAGE =
  "מספר טלפון לא תקין (7–15 ספרות, ניתן להוסיף קידומת בינלאומית עם +)";

export function normalizePhoneKey(phone: string) {
  return phone.replace(/\D+/g, "");
}

export function maskPhone(phone: string) {
  return String(phone).replace(/(\d{3})\d+(\d{2})/, "$1******$2");
}

export function isValidILPhone(phone: string) {
  const value = String(phone).trim();
  return (
    IL_LOCAL_REGEX.test(value) ||
    IL_INTL_REGEX.test(value) ||
    IL_PLUS_REGEX.test(value)
  );
}

/** Israeli or international phone (digits, optional +, spaces, dashes). */
export function isValidPhone(phone: string) {
  const value = String(phone).trim();
  if (!value) return false;
  if (isValidILPhone(value)) return true;
  if (!/^[\d\s\-+().]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= PHONE_DIGITS_MIN && digits.length <= PHONE_DIGITS_MAX;
}
