/**
 * תאריכים לפי יום קלנדרי בישראל, כמחרוזות ISO ("2026-10-13").
 * השרת רץ ב-UTC, ולכן "היום" נקבע תמיד כאן ולא מ-getDate() של השרת:
 * קובייה ליום מסוים לא נעלמת ב-02:00 בלילה ולא נשארת אחרי יומה האחרון.
 * מחרוזות ISO של תאריך בלבד ניתנות להשוואה לקסיקוגרפית.
 */
import { ISRAEL_TIME_ZONE } from "@/lib/time-zone";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;
const LAST_DAY_OF_WEEK_OFFSET = 6;

const israelDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ISRAEL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** היום בישראל ברגע נתון, כ-"YYYY-MM-DD". מטפל במעבר שעון קיץ/חורף */
export function israelDateOf(instant: Date): string {
  const parts = israelDateFormatter.formatToParts(instant);
  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** תאריך ISO אחרי הוספת ימים (שלילי = אחורה). חשבון ב-UTC, בלי השפעת שעון קיץ */
export function addDays(iso: string, days: number): string {
  return formatIso(new Date(parseIso(iso).getTime() + days * MS_PER_DAY));
}

/** יום ראשון עד שבת של השבוע שבו נמצא התאריך (שבוע ישראלי) */
export function israelWeekRange(iso: string): { start: string; end: string } {
  const dayOfWeek = parseIso(iso).getUTCDay(); // 0 = ראשון
  const start = addDays(iso, -(dayOfWeek % DAYS_IN_WEEK));
  return { start, end: addDays(start, LAST_DAY_OF_WEEK_OFFSET) };
}

/** האם התאריך תקין בלוח הגרגוריאני (ולא 2026-02-31) */
export function isValidIsoDate(iso: string): boolean {
  return ISO_DATE_PATTERN.test(iso) && formatIso(parseIso(iso)) === iso;
}

export interface DatedRange {
  starts_on: string;
  ends_on: string | null;
}

/** האם התקופה כוללת את היום הנתון; ends_on ריק = פתוחה (הנצחה) */
export function isCurrentInIsrael(range: DatedRange, today: string): boolean {
  return range.starts_on <= today && (range.ends_on ?? "9999-12-31") >= today;
}

/** האם שתי תקופות חופפות ולו ביום אחד (קצה פתוח = ללא סוף) */
export function rangesOverlap(a: DatedRange, b: DatedRange): boolean {
  const open = "9999-12-31";
  return (
    a.starts_on <= (b.ends_on ?? open) && b.starts_on <= (a.ends_on ?? open)
  );
}
