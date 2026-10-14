import { z } from "zod";

import {
  optionalEmail,
  optionalText,
  requiredChoice,
  requiredPhone,
  requiredText,
  requiredWholeNumber,
} from "@/lib/forms/schema";

/**
 * סכמה ומיפוי משותפים לטופס הצטרפות כשדכן, לעריכת הפרופיל העצמית ולעריכת
 * מנהל. כל העריכות עוברות כאן את אותה בדיקה (גם בצד השרת בנתיב המנהל).
 */

/** אורך מקסימלי לשם הרב (תואם ל-CHECK בעמודה synagogue_rabbi) */
export const SYNAGOGUE_RABBI_MAX_LENGTH = 100;

export const BIO_MAX_LENGTH = 2000;
/** אורך מקסימלי של "למה כדאי לאשר אותי" (תואם ל-CHECK בעמודה application_note) */
export const APPLICATION_NOTE_MAX_LENGTH = 1000;
const CITY_MAX_LENGTH = 100;
const LIST_MAX_LENGTH = 500;
const PHONE_MAX_LENGTH = 30;
const EMAIL_MAX_LENGTH = 200;
const COMMUNITY_MAX_LENGTH = 100;

const tooLong = (max: number) => `הטקסט ארוך מדי (עד ${max} תווים)`;

export const shadchanProfileSchema = z.object({
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
  /** העיר שמוצגת בכרטיס ברשימת השדכנים (העמודה location) */
  location: optionalText()
    .max(CITY_MAX_LENGTH, tooLong(CITY_MAX_LENGTH))
    .optional(),
  /**
   * "למה כדאי לאשר אותי" - להנהלה בלבד, אופציונלי. אופציונלי גם בסכמה
   * עצמה: גוף בקשה בלי המפתח (למשל מנתיב המנהל הישן) אינו מוחק את הערך.
   */
  application_note: optionalText()
    .max(APPLICATION_NOTE_MAX_LENGTH, tooLong(APPLICATION_NOTE_MAX_LENGTH))
    .optional(),
});

export type ShadchanFormData = z.infer<typeof shadchanProfileSchema>;

export const EMPTY_SHADCHAN_FORM: ShadchanFormData = {
  bio: "",
  experience_years: "",
  closed_matches: "",
  specializations: "",
  contact_phone: "",
  contact_email: "",
  languages: "",
  community: "",
  synagogue_rabbi: "",
  location: "",
  application_note: "",
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
  bio: string | null;
  experience_years: number | null;
  closed_matches: number | null;
  specializations: string[] | null;
  contact_phone: string | null;
  contact_email: string | null;
  languages: string[] | null;
  community: string;
  synagogue_rabbi: string;
  /** מופיע רק כשהטופס כולל אותו - אחרת העמודה אינה נכתבת */
  location?: string | null;
  /** מופיע רק כשהטופס כולל אותו - אחרת העמודה אינה נכתבת */
  application_note?: string | null;
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
    ...(data.location !== undefined ? { location: data.location || null } : {}),
    ...(shouldWriteNote
      ? { application_note: data.application_note || null }
      : {}),
  };
}

/** שורת shadchanim_info (או חלק ממנה) → ערכי טופס */
export interface ShadchanProfileRow {
  bio?: string | null;
  experience_years?: number | null;
  closed_matches?: number | null;
  specializations?: string[] | string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  languages?: string[] | string | null;
  community?: string | null;
  synagogue_rabbi?: string | null;
  location?: string | null;
  application_note?: string | null;
}

const listToText = (value: string[] | string | null | undefined) =>
  Array.isArray(value) ? value.join(", ") : value || "";

export function rowToForm(row: ShadchanProfileRow): ShadchanFormData {
  return {
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
    location: row.location || "",
    application_note: row.application_note || "",
  };
}

/** עמודות הפרופיל לשליפה (select) לעריכה */
export const SHADCHAN_PROFILE_SELECT =
  "bio, experience_years, closed_matches, specializations, contact_phone, contact_email, languages, community, synagogue_rabbi, location, application_note";
