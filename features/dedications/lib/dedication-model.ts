/**
 * מודל קוביות ההקדשה (טהור, בלי React ובלי גישה למסד).
 * Callers: טופס וניהול ההקדשות, רכיבי התצוגה הציבורית, שליפת הקוביות לאתר.
 */

export const DEDICATION_KINDS = [
  "sponsor_day",
  "sponsor_week",
  "sponsor_month",
  "memorial",
] as const;

export type DedicationKind = (typeof DEDICATION_KINDS)[number];

/** סוגי הפרנס, מהקטן לגדול (סדר התצוגה בניהול הפוך: חודש ראשון) */
export type SponsorKind = Exclude<DedicationKind, "memorial">;

export const SPONSOR_KINDS_LARGEST_FIRST: readonly SponsorKind[] = [
  "sponsor_month",
  "sponsor_week",
  "sponsor_day",
];

/** סוגי ההקדשה, זהים לאלה שבטופס התרומה (features/donations/lib/donation-form.ts) */
export const DEDICATION_TYPE_VALUES = [
  "לעילוי נשמת",
  "לרפואת",
  "לזכות",
  "להצלחת",
] as const;

export type DedicationTypeValue = (typeof DEDICATION_TYPE_VALUES)[number];

/** ערך "ללא סוג" בשדה הבחירה של הטופס (בבסיס הנתונים: NULL) */
export const NO_DEDICATION_TYPE = "";

export const KIND_LABELS: Record<DedicationKind, string> = {
  sponsor_day: "פרנס היום",
  sponsor_week: "פרנס השבוע",
  sponsor_month: "פרנס החודש",
  memorial: "הנצחה",
};

/** הטקסט שבקוביית "פנוי" לכל משבצת */
export const AVAILABLE_SLOT_TEXT: Record<SponsorKind, string> = {
  sponsor_day: "פרנס היום פנוי",
  sponsor_week: "פרנס השבוע פנוי",
  sponsor_month: "פרנס החודש פנוי",
};

export const AVAILABLE_SLOT_CTA: Record<SponsorKind, string> = {
  sponsor_day: "להקדשת היום",
  sponsor_week: "להקדשת השבוע",
  sponsor_month: "להקדשת החודש",
};

/** מגבלות האורך (מקבילות ל-CHECK בבסיס הנתונים) */
export const HONOREE_MAX_LENGTH = 120;
export const DONOR_LINE_MAX_LENGTH = 120;
export const NOTE_MAX_LENGTH = 200;
export const SORT_ORDER_MAX = 100000;

/** הנתונים הציבוריים של קובייה: בלי מזהה יוצר ובלי סטטוס פרסום */
export interface PublicDedication {
  id: string;
  kind: DedicationKind;
  dedication_type: DedicationTypeValue | null;
  honoree: string;
  donor_line: string | null;
  note: string | null;
  starts_on: string;
  ends_on: string | null;
  sort_order: number;
}

/** שורה בניהול: הנתונים הציבוריים + פרסום */
export interface AdminDedication extends PublicDedication {
  is_published: boolean;
  /** התרומה שממנה נוצרה (רכישת פרנס); null = הוזנה ידנית */
  donation_id?: string | null;
  /** נוצרה מתשלום במשבצת שכבר הייתה תפוסה: לא פורסמה, ממתינה למנהל */
  needs_review?: boolean;
}

/** העמודות שהאתר הציבורי רשאי לבקש (תואם GRANT SELECT ל-anon) */
export const PUBLIC_DEDICATION_COLUMNS =
  "id, kind, dedication_type, honoree, donor_line, note, starts_on, ends_on, sort_order";

export function isSponsorKind(kind: DedicationKind): kind is SponsorKind {
  return kind !== "memorial";
}

/** הטקסט הראשי של הקובייה: "לעילוי נשמת משה בן שרה" */
export function dedicationHeadline(
  dedicationType: string | null,
  honoree: string,
): string {
  return [dedicationType, honoree.trim()].filter(Boolean).join(" ");
}

/** סדר תצוגה בתוך משבצת: sort_order ואז תאריך התחלה */
export function compareDedications(
  a: Pick<PublicDedication, "sort_order" | "starts_on">,
  b: Pick<PublicDedication, "sort_order" | "starts_on">,
): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.starts_on.localeCompare(b.starts_on);
}
