import { z } from "zod";

import {
  optionalEmail,
  optionalText,
  requiredChoice,
  requiredPhone,
  requiredText,
  requiredWholeNumber,
} from "@/lib/forms/schema";

import { isShadchanGender } from "./gender";
import { isShadchanMatchType, normalizeMatchTypes } from "./match-types";

/**
 * סכמה ומיפוי משותפים לטופס הצטרפות כשדכן, לעריכת הפרופיל העצמית ולעריכת
 * מנהל. כל העריכות עוברות כאן את אותה בדיקה (גם בצד השרת בנתיב המנהל).
 */

/** אורך מקסימלי לשם הרב (תואם ל-CHECK בעמודה synagogue_rabbi) */
export const SYNAGOGUE_RABBI_MAX_LENGTH = 100;

export const BIO_MAX_LENGTH = 2000;
/** אורך מקסימלי של "למה כדאי לאשר אותי" (תואם ל-CHECK בעמודה application_note) */
export const APPLICATION_NOTE_MAX_LENGTH = 1000;
/** אורך מקסימלי של "מי הפנה אותך" (תואם ל-CHECK בעמודה referral_source) */
export const REFERRAL_SOURCE_MAX_LENGTH = 200;
const CITY_MAX_LENGTH = 100;
const LIST_MAX_LENGTH = 500;
const PHONE_MAX_LENGTH = 30;
const EMAIL_MAX_LENGTH = 200;
const COMMUNITY_MAX_LENGTH = 100;

export const MATCH_TYPES_REQUIRED_MESSAGE = "נא לבחור לפחות סוג שידוכים אחד";

const tooLong = (max: number) => `הטקסט ארוך מדי (עד ${max} תווים)`;

/** טווח הגיל המותר לשדכן (תואם ל-assert_shadchan_application_complete) */
export const SHADCHAN_MIN_AGE = 18;
export const SHADCHAN_MAX_AGE = 100;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** הגיל המלא בתאריך מסוים, מ-"YYYY-MM-DD"; null כשהתאריך אינו תקין */
export function ageFromBirthDate(
  birthDate: string,
  today: Date = new Date(),
): number | null {
  if (!ISO_DATE_PATTERN.test(birthDate)) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  const birth = new Date(Date.UTC(year, month - 1, day));
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day
  ) {
    return null;
  }
  const hasHadBirthday =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  return today.getFullYear() - year - (hasHadBirthday ? 0 : 1);
}

function isAllowedAge(birthDate: string): boolean {
  const age = ageFromBirthDate(birthDate);
  return age !== null && age >= SHADCHAN_MIN_AGE && age <= SHADCHAN_MAX_AGE;
}

/** השדות עצמם, בלי הבדיקות שתלויות בכמה שדות (ראו shadchanProfileSchema) */
export const shadchanProfileBaseSchema = z.object({
  gender: requiredChoice("שדכן / שדכנית").refine(isShadchanGender, {
    message: "נא לבחור שדכן / שדכנית",
  }),
  birth_date: requiredChoice("תאריך לידה").refine(isAllowedAge, {
    message: `הגיל חייב להיות בין ${SHADCHAN_MIN_AGE} ל-${SHADCHAN_MAX_AGE}`,
  }),
  /** נתיב ב-shadchan-avatars; חובה לשדכן (male), רשות לשדכנית */
  avatar_path: optionalText().max(200),
  bio: requiredText("ביוגרפיה").max(BIO_MAX_LENGTH, tooLong(BIO_MAX_LENGTH)),
  experience_years: requiredWholeNumber("שנות ניסיון").max(4, "ערך לא סביר"),
  closed_matches: requiredWholeNumber("מספר השידוכים שנסגרו").max(
    6,
    "ערך לא סביר",
  ),
  specializations: optionalText().max(
    LIST_MAX_LENGTH,
    tooLong(LIST_MAX_LENGTH),
  ),
  contact_phone: requiredPhone("טלפון ליצירת קשר").max(
    PHONE_MAX_LENGTH,
    tooLong(PHONE_MAX_LENGTH),
  ),
  contact_email: optionalEmail().refine(
    (value) => value.length <= EMAIL_MAX_LENGTH,
    tooLong(EMAIL_MAX_LENGTH),
  ),
  languages: optionalText().max(LIST_MAX_LENGTH, tooLong(LIST_MAX_LENGTH)),
  community: requiredChoice("קהילה / חסידות").max(
    COMMUNITY_MAX_LENGTH,
    tooLong(COMMUNITY_MAX_LENGTH),
  ),
  synagogue_rabbi: requiredText("רב בית הכנסת שלך").max(
    SYNAGOGUE_RABBI_MAX_LENGTH,
    `שם הרב ארוך מדי (עד ${SYNAGOGUE_RABBI_MAX_LENGTH} תווים)`,
  ),
  /** טלפון של הרב (העמודה rabbi_phone) - להנהלה בלבד */
  rabbi_phone: requiredPhone("טלפון של הרב").max(
    PHONE_MAX_LENGTH,
    tooLong(PHONE_MAX_LENGTH),
  ),
  /** עיר המגורים, שמוצגת בכרטיס ברשימת השדכנים (העמודה location) */
  location: requiredText("עיר מגורים").max(
    CITY_MAX_LENGTH,
    tooLong(CITY_MAX_LENGTH),
  ),
  /** "סוג שידוכים שעוסק": לפחות אחד מהרשימה (match-types.ts) */
  match_types: z
    .array(z.string().refine(isShadchanMatchType, "ערך לא מוכר"))
    .min(1, MATCH_TYPES_REQUIRED_MESSAGE),
  /**
   * "למה כדאי לאשר אותי" - להנהלה בלבד, אופציונלי. אופציונלי גם בסכמה
   * עצמה: גוף בקשה בלי המפתח (למשל מנתיב המנהל הישן) אינו מוחק את הערך.
   */
  application_note: optionalText()
    .max(APPLICATION_NOTE_MAX_LENGTH, tooLong(APPLICATION_NOTE_MAX_LENGTH))
    .optional(),
  /** "מי הפנה אותך לקול מצהלות?" - להנהלה בלבד, אופציונלי, כמו application_note */
  referral_source: optionalText()
    .max(REFERRAL_SOURCE_MAX_LENGTH, tooLong(REFERRAL_SOURCE_MAX_LENGTH))
    .optional(),
});

export const AVATAR_REQUIRED_MESSAGE = "נא להעלות תמונה (חובה לשדכנים)";

/** בדיקות בין שדות: תמונה חובה לשדכן (male). משותף לטופס ולנתיב המנהל */
export function refineShadchanProfile(
  values: { gender: string; avatar_path: string },
  ctx: z.RefinementCtx,
): void {
  if (values.gender === "male" && !values.avatar_path) {
    ctx.addIssue({
      code: "custom",
      path: ["avatar_path"],
      message: AVATAR_REQUIRED_MESSAGE,
    });
  }
}

export const shadchanProfileSchema = shadchanProfileBaseSchema.superRefine(
  refineShadchanProfile,
);

export type ShadchanFormData = z.infer<typeof shadchanProfileSchema>;

export const EMPTY_SHADCHAN_FORM: ShadchanFormData = {
  gender: "",
  birth_date: "",
  avatar_path: "",
  bio: "",
  experience_years: "",
  closed_matches: "",
  specializations: "",
  contact_phone: "",
  contact_email: "",
  languages: "",
  community: "",
  synagogue_rabbi: "",
  rabbi_phone: "",
  location: "",
  match_types: [],
  application_note: "",
  referral_source: "",
};

/** "עברית, אנגלית" → ["עברית", "אנגלית"]; ריק → null */
export function toList(value: string): string[] | null {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

/** עמודות הפרופיל בלבד: לעולם לא שדות סטטוס, תאריכי הגשה או החלטה */
export interface ShadchanProfileColumns {
  gender: string | null;
  birth_date: string | null;
  avatar_path: string | null;
  bio: string | null;
  experience_years: number | null;
  closed_matches: number | null;
  specializations: string[] | null;
  contact_phone: string | null;
  contact_email: string | null;
  languages: string[] | null;
  community: string;
  synagogue_rabbi: string;
  rabbi_phone: string;
  location: string;
  match_types: string[];
  /** מופיעים רק כשהטופס כולל אותם - אחרת העמודות אינן נכתבות */
  application_note?: string | null;
  referral_source?: string | null;
}

interface FormToColumnsOptions {
  /**
   * האם לכתוב את application_note. ברירת מחדל: רק אם הערך הגיע בטופס.
   * עריכה עצמית של שדכן מאושר מעבירה false, כדי לא לדרוס את ההערה להנהלה.
   */
  includeApplicationNote?: boolean;
}

/** ערכי הטופס (כבר מאומתים) → עמודות shadchanim_info */
export function formToColumns(
  data: ShadchanFormData,
  { includeApplicationNote }: FormToColumnsOptions = {},
): ShadchanProfileColumns {
  const shouldWriteNote =
    includeApplicationNote ?? data.application_note !== undefined;
  return {
    gender: data.gender || null,
    birth_date: data.birth_date || null,
    avatar_path: data.avatar_path || null,
    bio: data.bio || null,
    experience_years: data.experience_years
      ? parseInt(data.experience_years, 10)
      : null,
    specializations: toList(data.specializations),
    contact_phone: data.contact_phone || null,
    contact_email: data.contact_email || null,
    languages: toList(data.languages),
    closed_matches: data.closed_matches
      ? parseInt(data.closed_matches, 10)
      : null,
    community: data.community,
    synagogue_rabbi: data.synagogue_rabbi,
    rabbi_phone: data.rabbi_phone,
    location: data.location,
    match_types: normalizeMatchTypes(data.match_types),
    ...(shouldWriteNote
      ? {
          application_note: data.application_note || null,
          referral_source: data.referral_source || null,
        }
      : {}),
  };
}

/** שורת shadchanim_info (או חלק ממנה) → ערכי טופס */
export interface ShadchanProfileRow {
  gender?: string | null;
  birth_date?: string | null;
  avatar_path?: string | null;
  bio?: string | null;
  experience_years?: number | null;
  closed_matches?: number | null;
  specializations?: string[] | string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  languages?: string[] | string | null;
  community?: string | null;
  synagogue_rabbi?: string | null;
  rabbi_phone?: string | null;
  location?: string | null;
  match_types?: string[] | null;
  application_note?: string | null;
  referral_source?: string | null;
}

const listToText = (value: string[] | string | null | undefined) =>
  Array.isArray(value) ? value.join(", ") : value || "";

export function rowToForm(row: ShadchanProfileRow): ShadchanFormData {
  return {
    // שדכנים ותיקים: ריק, ויידרש בשמירה הבאה
    gender: row.gender || "",
    birth_date: row.birth_date || "",
    avatar_path: row.avatar_path || "",
    bio: row.bio || "",
    experience_years: row.experience_years?.toString() || "",
    closed_matches: row.closed_matches?.toString() || "",
    specializations: listToText(row.specializations),
    contact_phone: row.contact_phone || "",
    contact_email: row.contact_email || "",
    languages: listToText(row.languages),
    community: row.community || "",
    // בקשות/פרופילים שנשמרו לפני שהשדה נדרש: ריק, ויידרש במילוי הבא
    synagogue_rabbi: row.synagogue_rabbi || "",
    rabbi_phone: row.rabbi_phone || "",
    location: row.location || "",
    match_types: normalizeMatchTypes(row.match_types),
    application_note: row.application_note || "",
    referral_source: row.referral_source || "",
  };
}

/** עמודות הפרופיל לשליפה (select) לעריכה */
export const SHADCHAN_PROFILE_SELECT =
  "gender, birth_date, avatar_path, bio, experience_years, closed_matches, specializations, contact_phone, contact_email, languages, community, synagogue_rabbi, rabbi_phone, location, match_types, application_note, referral_source";
