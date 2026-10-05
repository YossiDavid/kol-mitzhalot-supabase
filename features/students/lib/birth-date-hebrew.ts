import { jewishDateHebrew } from "@/lib/jewishDatte";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * תאריך הלידה בלוח העברי בלבד ("כ״ג בטבת תשנ״ח"), או null כשאין תאריך תקין.
 *
 * מחושב בשרת ונמסר ללקוח כמחרוזת, כך שתאריך הלידה הלועזי עצמו לא עובר
 * לרכיב הלקוח. התאריך נבנה כיום מקומי (בצהריים) ולא כ-UTC, כדי שהמרת אזור
 * זמן לא תזיז אותו ביום.
 */
export function hebrewBirthDate(
  birthDate: string | null | undefined,
): string | null {
  const iso = birthDate?.trim().slice(0, 10);
  if (!iso || !ISO_DATE_PATTERN.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return jewishDateHebrew(new Date(year, month - 1, day, 12));
}
