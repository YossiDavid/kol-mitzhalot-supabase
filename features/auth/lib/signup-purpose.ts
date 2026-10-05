/**
 * "מטרת ההרשמה" שנבחרת בטופס ההרשמה. נשמרת ב-user_metadata.signup_purpose
 * (ולא בטריגר ההרשמה ב-DB): למשתמשים קיימים ולמשתמשים שנוצרו על ידי מנהל
 * אין ערך, וזה תקין.
 */
export const SIGNUP_PURPOSE_OPTIONS = [
  { value: "self", label: "אני מחפש/ת שידוך לעצמי" },
  { value: "child", label: "אני מחפש/ת שידוך לבני/בתי" },
  { value: "shadchan", label: "אני רוצה להצטרף כשדכן/ית" },
  { value: "other", label: "אחר" },
] as const;

export type SignupPurpose = (typeof SIGNUP_PURPOSE_OPTIONS)[number]["value"];

/** שם שדה המטא-דאטה של המשתמש */
export const SIGNUP_PURPOSE_METADATA_KEY = "signup_purpose";

const LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  SIGNUP_PURPOSE_OPTIONS.map(({ value, label }) => [value, label]),
);

export function isSignupPurpose(value: unknown): value is SignupPurpose {
  return typeof value === "string" && value in LABEL_BY_VALUE;
}

/** התווית בעברית; "—" כשאין ערך או שהערך אינו מוכר */
export function getSignupPurposeLabel(value: unknown): string {
  return isSignupPurpose(value) ? LABEL_BY_VALUE[value] : "—";
}

/** קורא את מטרת ההרשמה מ-user_metadata; null כשחסרה */
export function readSignupPurpose(user: {
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const raw = user.user_metadata?.[SIGNUP_PURPOSE_METADATA_KEY];
  return typeof raw === "string" && raw ? raw : null;
}
