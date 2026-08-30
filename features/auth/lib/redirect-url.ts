/**
 * בונה כתובת חזרה עבור מיילי Supabase Auth מתוך הדומיין שממנו הגולש נכנס בפועל
 * (פרודקשן / preview ב-Vercel / localhost), כך שהקישור במייל יחזיר אותו לאותה סביבה.
 *
 * הערך שמוחזר מגיע לתבנית המייל כ-{{ .RedirectTo }}, ולכן הוא חייב להיות
 * **ללא query string** — התבנית מוסיפה בעצמה ?token_hash=...&type=...
 * ראו: https://supabase.com/docs/guides/auth/redirect-urls
 *
 * שימו לב: הכתובת חייבת להופיע ב-Supabase Dashboard → Authentication →
 * URL Configuration → Redirect URLs, אחרת ההפניה לא תעבוד.
 */
export function getAuthRedirectUrl(path: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${path}`;
}

/** יעד magic link והרשמה. הנתיב /auth/confirm מפנה ל-/app לאחר אימות מוצלח. */
export const AUTH_CONFIRM_PATH = "/auth/confirm";

/** יעד קישור איפוס הסיסמה. */
export const AUTH_UPDATE_PASSWORD_PATH = "/auth/update-password";
