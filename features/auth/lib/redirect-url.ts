import {
  DEFAULT_NEXT_PATH,
  sanitizeNextPath,
} from "@/features/auth/lib/next-path";

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

/**
 * נתיב ה-confirm שייכנס ל-`emailRedirectTo` כשרוצים לחזור אחרי ההתחברות
 * ליעד מסוים ולא ל-/app (למשל הצעת שידוך שקישור במייל הוביל אליה).
 *
 * היעד נישא כסגמנטים של הנתיב ולא כ-`?next=`, כי תבנית ה-Magic Link מוסיפה
 * בעצמה `?token_hash=...&type=...` אל `{{ .RedirectTo }}` — ערך שכבר מכיל
 * query string היה נשבר שם. הנתיב שנוצר נקלט ב-app/auth/confirm/[...next].
 * ראו email-templates/supabase/magic-link.html.
 *
 * מגבלה מכוונת: query string ביעד נחתך, כי הוא אינו שורד את המסלול הזה.
 */
export function buildConfirmPath(next: string | null | undefined): string {
  const safe = sanitizeNextPath(next);
  if (safe === DEFAULT_NEXT_PATH) return AUTH_CONFIRM_PATH;
  const [pathname] = safe.split("?");
  return `${AUTH_CONFIRM_PATH}${pathname}`;
}

/** יעד קישור איפוס הסיסמה. */
export const AUTH_UPDATE_PASSWORD_PATH = "/auth/update-password";
