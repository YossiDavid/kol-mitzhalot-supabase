/**
 * מגדר השדכן (shadchanim_info.gender) והכותרת שנגזרת ממנו: "השדכן הרב ..."
 * לשדכן, "השדכנית גב' ..." לשדכנית, ו"השדכן/ית ..." כשהמגדר לא ידוע
 * (שדכנים ותיקים שלא מילאו, או מנהל).
 */

export const SHADCHAN_GENDER_OPTIONS = [
  { value: "male", label: "שדכן" },
  { value: "female", label: "שדכנית" },
] as const;

export type ShadchanGender = (typeof SHADCHAN_GENDER_OPTIONS)[number]["value"];

export function isShadchanGender(value: unknown): value is ShadchanGender {
  return value === "male" || value === "female";
}

/** ערך מהמסד/מהטופס → מגדר, או null כשאין ערך מוכר */
export function parseShadchanGender(value: unknown): ShadchanGender | null {
  return isShadchanGender(value) ? value : null;
}

const TITLE_PREFIX: Record<ShadchanGender, string> = {
  male: "השדכן הרב",
  female: "השדכנית גב'",
};

const UNKNOWN_TITLE_PREFIX = "השדכן/ית";

/** החלק שלפני השם: "השדכן הרב" / "השדכנית גב'" / "השדכן/ית" */
export function shadchanTitlePrefix(gender: ShadchanGender | null): string {
  return gender ? TITLE_PREFIX[gender] : UNKNOWN_TITLE_PREFIX;
}

/** "השדכן הרב דוד פרידמן" / "השדכנית גב' שרה וייס" / "השדכן/ית <שם>" */
export function formatShadchanTitle(
  name: string,
  gender: ShadchanGender | null,
): string {
  return `${shadchanTitlePrefix(gender)} ${name.trim()}`;
}

/** "שדכן משנת" / "שדכנית משנת" / "שדכן/ית משנת" */
export function shadchanRoleLabel(gender: ShadchanGender | null): string {
  if (gender === "female") return "שדכנית";
  if (gender === "male") return "שדכן";
  return "שדכן/ית";
}
