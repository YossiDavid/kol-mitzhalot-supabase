/**
 * אישור התקנון - קבועים משותפים לשרת וללקוח (טופס ההרשמה, חסימת /app,
 * עורך התוכן של המנהל). ראו supabase/migrations/20261029090000_terms_acceptance.sql.
 */

/** מפתח התקנון ב-system_content (גם ה-slug של /legal/<key>) */
export const TERMS_CONTENT_KEY = "terms-of-service";

/** דף התקנון הציבורי */
export const TERMS_PAGE_PATH = `/legal/${TERMS_CONTENT_KEY}`;

/**
 * הגרסה שאושרה בטופס ההרשמה, ב-user_metadata. נרשמת כאישור אמיתי
 * (terms_acceptances) בכניסה הראשונה ל-/app, אם היא עדיין הגרסה הנוכחית.
 */
export const SIGNUP_TERMS_VERSION_METADATA_KEY = "terms_accepted_version";

export const TERMS_CHECKBOX_LABEL = "קראתי ואני מסכים/ה לתקנון";

/** הגרסה שאושרה בהרשמה, או null כשאין ערך תקין */
export function readSignupTermsVersion(user: {
  user_metadata?: Record<string, unknown> | null;
}): number | null {
  const raw = user.user_metadata?.[SIGNUP_TERMS_VERSION_METADATA_KEY];
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1
    ? raw
    : null;
}

/** האם נדרש אישור: יש גרסה שפורסמה, והמשתמש עוד לא אישר אותה */
export function needsTermsAcceptance({
  requiredVersion,
  acceptedVersion,
}: {
  requiredVersion: number;
  acceptedVersion: number;
}): boolean {
  return requiredVersion > 0 && acceptedVersion < requiredVersion;
}
