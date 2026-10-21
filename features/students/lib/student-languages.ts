/**
 * "שפת אם" ו"שפות נוספות" בכרטיס המיועד/ת (students.native_language,
 * students.languages). הערך הנשמר הוא שם השפה עצמו, כמו בשדה "מוכן/ה לגור ב:".
 *
 * בטופס: בחירה מתוך רשימה קבועה, ו"אחר" פותח שדה טקסט לשפה שאינה ברשימה.
 * "אחר" עצמו לעולם אינו נשמר - נשמר הטקסט שהוקלד. בעריכה, ערך שמור שאינו
 * ברשימה חוזר כ"אחר" + הטקסט שלו, כך שאין אובדן מידע.
 */

/** "אחר" בטופס בלבד: פותח את שדה הטקסט החופשי */
export const OTHER_LANGUAGE = "אחר";

export const LANGUAGE_NAMES = [
  "עברית",
  "אידיש",
  "אנגלית",
  "צרפתית",
  "רוסית",
  "ספרדית",
  "ערבית",
  "הונגרית",
  "גרמנית",
  "הולנדית",
  "איטלקית",
  "פורטוגזית",
  "אמהרית",
] as const;

const KNOWN_LANGUAGES: ReadonlySet<string> = new Set(LANGUAGE_NAMES);

/** מפריד בין שפות בשדה הטקסט של "שפות נוספות" ("פרסית, יוונית") */
const OTHER_LANGUAGES_SEPARATOR = /[,،]/;

export type NativeLanguageFormValue = {
  nativeLanguage: string;
  nativeLanguageOther: string;
};

export type LanguagesFormValue = {
  languages: string[];
  languagesOther: string;
};

/** שפת האם לשמירה: שם השפה, הטקסט של "אחר", או null כשלא צוינה */
export function toStoredNativeLanguage(
  value: NativeLanguageFormValue,
): string | null {
  const chosen =
    value.nativeLanguage === OTHER_LANGUAGE
      ? value.nativeLanguageOther
      : value.nativeLanguage;
  return chosen.trim() || null;
}

/** השפות הנוספות לשמירה: מהרשימה ומהטקסט של "אחר", בלי כפילויות וריקים */
export function toStoredLanguages(value: LanguagesFormValue): string[] {
  const listed = value.languages.filter(
    (language) => language !== OTHER_LANGUAGE,
  );
  const typed = value.languages.includes(OTHER_LANGUAGE)
    ? value.languagesOther.split(OTHER_LANGUAGES_SEPARATOR)
    : [];
  const all = [...listed, ...typed]
    .map((language) => language.trim())
    .filter(Boolean);
  return [...new Set(all)];
}

/** שפת אם שמורה בחזרה לטופס */
export function nativeLanguageToForm(
  stored: string | null | undefined,
): NativeLanguageFormValue {
  const value = stored?.trim() ?? "";
  if (!value || KNOWN_LANGUAGES.has(value)) {
    return { nativeLanguage: value, nativeLanguageOther: "" };
  }
  return { nativeLanguage: OTHER_LANGUAGE, nativeLanguageOther: value };
}

/** שפות שמורות בחזרה לטופס: שפות שאינן ברשימה עוברות לטקסט של "אחר" */
export function languagesToForm(
  stored: readonly string[] | null | undefined,
): LanguagesFormValue {
  const values = (stored ?? [])
    .map((language) => language.trim())
    .filter(Boolean);
  const listed = values.filter((language) => KNOWN_LANGUAGES.has(language));
  const other = values.filter((language) => !KNOWN_LANGUAGES.has(language));
  return {
    languages: other.length ? [...listed, OTHER_LANGUAGE] : listed,
    languagesOther: other.join(", "),
  };
}
