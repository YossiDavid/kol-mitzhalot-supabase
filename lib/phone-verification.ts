import { normalizePhoneKey, resolveUserPhone } from "@/lib/phone";

/**
 * אימות טלפון: מקור האמת הוא app_metadata.verified_phone, שנכתב רק בשרת
 * (service role) אחרי קוד OTP תקין. user_metadata נכתב בידי המשתמש עצמו
 * (supabase.auth.updateUser מהדפדפן), ולכן אסור לסמוך עליו כאן.
 *
 * הטלפון "מאומת" כשהמספר הנוכחי של המשתמש זהה למספר שאומת. החלפת מספר
 * בהגדרות מחייבת אימות מחדש בלי שום דגל נוסף.
 */
interface PhoneVerificationUser {
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}

export function verifiedPhoneOf(user: PhoneVerificationUser): string | null {
  const value = user.app_metadata?.verified_phone;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isPhoneVerified(user: PhoneVerificationUser): boolean {
  const current = resolveUserPhone(user);
  const verified = verifiedPhoneOf(user);
  if (!current || !verified) return false;
  return normalizePhoneKey(current) === normalizePhoneKey(verified);
}
