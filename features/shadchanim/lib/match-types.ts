/**
 * "סוג שידוכים שעוסק" בטופס השדכן: בחירה מרובה מתוך רשימה סגורה. המפתחות
 * נשמרים ב-shadchanim_info.match_types ותואמים ל-CHECK בעמודה
 * (20261101200000_shadchan_form_match_types_rabbi_phone.sql).
 */
export const SHADCHAN_MATCH_TYPE_OPTIONS = [
  { value: "young", label: "צעירים" },
  { value: "older", label: "מבוגרים" },
  { value: "divorced", label: "גרושים / גרושות" },
  { value: "widowed", label: "אלמנים / אלמנות" },
  { value: "baalei_teshuva", label: "בעלי תשובה" },
  { value: "special_needs", label: "צרכים מיוחדים" },
  { value: "all", label: "הכל" },
] as const;

export type ShadchanMatchType =
  (typeof SHADCHAN_MATCH_TYPE_OPTIONS)[number]["value"];

const LABEL_BY_VALUE: ReadonlyMap<string, string> = new Map(
  SHADCHAN_MATCH_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
);

export function isShadchanMatchType(value: string): value is ShadchanMatchType {
  return LABEL_BY_VALUE.has(value);
}

/** מפתחות → "צעירים, גרושים / גרושות" לפי סדר הרשימה; ערך לא מוכר מושמט */
export function formatMatchTypes(values: readonly string[] | null): string {
  if (!values) return "";
  return SHADCHAN_MATCH_TYPE_OPTIONS.filter(({ value }) =>
    values.includes(value),
  )
    .map(({ label }) => label)
    .join(", ");
}

/** מפתחות מוכרים בלבד, בלי כפילויות ובסדר הרשימה (לשורה מהמסד) */
export function normalizeMatchTypes(
  values: readonly string[] | null | undefined,
): ShadchanMatchType[] {
  if (!values) return [];
  return SHADCHAN_MATCH_TYPE_OPTIONS.map(({ value }) => value).filter((value) =>
    values.includes(value),
  );
}
