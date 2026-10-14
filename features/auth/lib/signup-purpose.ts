/**
 * "מטרת ההרשמה" שנבחרת בטופס ההרשמה. נשמרת ב-user_metadata.signup_purpose
 * (ולא בטריגר ההרשמה ב-DB): למשתמשים קיימים ולמשתמשים שנוצרו על ידי מנהל
 * אין ערך, וזה תקין.
 */
export const SIGNUP_PURPOSE_OPTIONS = [
  { value: "self", label: "אני מחפש/ת שידוך לעצמי" },
  { value: "child", label: "אני מחפש/ת שידוך לבני/בתי" },
  { value: "shadchan", label: "אני רוצה להצטרף כשדכן/ית" },
  { value: "staff", label: "אני רוצה להצטרף כאיש צוות" },
  { value: "other", label: "אחר" },
] as const;

export type SignupPurpose = (typeof SIGNUP_PURPOSE_OPTIONS)[number]["value"];

/** שם שדה המטא-דאטה של המשתמש */
export const SIGNUP_PURPOSE_METADATA_KEY = "signup_purpose";

/** שם שדה המטא-דאטה של הטקסט החופשי כשנבחר "אחר" */
export const SIGNUP_PURPOSE_OTHER_METADATA_KEY = "signup_purpose_other";

/** גבולות אורך הטקסט החופשי (אחרי trim); זהים לחיתוך בטריגר ההתראה */
export const SIGNUP_PURPOSE_OTHER_MIN_LENGTH = 2;
export const SIGNUP_PURPOSE_OTHER_MAX_LENGTH = 100;

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

/** קורא את הטקסט החופשי של "אחר" מ-user_metadata; null כשחסר או ריק */
export function readSignupPurposeOther(user: {
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const raw = user.user_metadata?.[SIGNUP_PURPOSE_OTHER_METADATA_KEY];
  if (typeof raw !== "string") return null;
  const text = raw.trim().slice(0, SIGNUP_PURPOSE_OTHER_MAX_LENGTH);
  return text || null;
}

/**
 * התווית להצגה למנהלים: "אחר: <טקסט>" כשנבחר "אחר" והוזן טקסט, אחרת התווית
 * הרגילה. הטקסט נחתך לאורך המותר ונשאר גולמי - הבריחה באחריות המציג.
 */
export function formatSignupPurposeLabel(
  purpose: unknown,
  other: string | null | undefined,
): string {
  const label = getSignupPurposeLabel(purpose);
  const text = other?.trim().slice(0, SIGNUP_PURPOSE_OTHER_MAX_LENGTH);
  return purpose === "other" && text ? `${label}: ${text}` : label;
}
