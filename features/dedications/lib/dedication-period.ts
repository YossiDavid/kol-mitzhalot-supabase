/**
 * הצגת תקופת קובייה: תאריך עברי (עיקרי) ולועזי (משני). טהור, ללא React.
 * התאריך נבנה כיום מקומי בצהריים, כדי שהמרת אזור זמן לא תזיז אותו ביום
 * (כמו features/students/lib/birth-date-hebrew.ts).
 */
import { toHebrewJewishDate, toJewishDate } from "jewish-date";

import { ISO_DATE_PATTERN } from "@/features/dedications/lib/israel-date";

const NOON_HOUR = 12;

export function localNoon(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day, NOON_HOUR);
}

/** "13.10.2026" */
function gregorianLabel(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}.${year}`;
}

/** "13.10" (בלי שנה, לתחילת טווח באותה שנה) */
function gregorianShort(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}`;
}

interface HebrewParts {
  day: string;
  month: string;
  year: string;
  monthKey: string;
}

function hebrewParts(iso: string): HebrewParts {
  const jewish = toJewishDate(localNoon(iso));
  const hebrew = toHebrewJewishDate(jewish);
  return {
    day: hebrew.day,
    month: hebrew.monthName,
    year: hebrew.year,
    monthKey: `${jewish.year}-${jewish.monthName}`,
  };
}

/** "ב׳ חשון התשפ״ז" */
export function hebrewDateLabel(iso: string): string {
  const { day, month, year } = hebrewParts(iso);
  return `${day} ${month} ${year}`;
}

/**
 * תאריך עברי של טווח: את החודש והשנה מציינים פעם אחת כשהם משותפים.
 *   יום אחד:     "ב׳ חשון התשפ״ז"
 *   אותו חודש:   "ב׳ – ח׳ חשון התשפ״ז"
 *   חודשים שונים: "כ״ט תשרי – ו׳ חשון התשפ״ז"
 */
function hebrewRangeLabel(start: string, end: string): string {
  if (start === end) return hebrewDateLabel(start);
  const from = hebrewParts(start);
  const to = hebrewParts(end);
  if (from.monthKey === to.monthKey) {
    return `${from.day} – ${to.day} ${to.month} ${to.year}`;
  }
  if (from.year === to.year) {
    return `${from.day} ${from.month} – ${to.day} ${to.month} ${to.year}`;
  }
  return `${hebrewDateLabel(start)} – ${hebrewDateLabel(end)}`;
}

function gregorianRangeLabel(start: string, end: string): string {
  if (start === end) return gregorianLabel(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const from = sameYear ? gregorianShort(start) : gregorianLabel(start);
  return `${from} – ${gregorianLabel(end)}`;
}

export interface PeriodLabel {
  hebrew: string;
  gregorian: string;
}

/** null כשאין תקופה להציג (תאריך לא תקין, או הנצחה פתוחה) */
export function dedicationPeriodLabel(
  startsOn: string,
  endsOn: string | null,
): PeriodLabel | null {
  if (!ISO_DATE_PATTERN.test(startsOn)) return null;
  if (!endsOn || !ISO_DATE_PATTERN.test(endsOn) || endsOn < startsOn) {
    return null;
  }
  return {
    hebrew: hebrewRangeLabel(startsOn, endsOn),
    gregorian: gregorianRangeLabel(startsOn, endsOn),
  };
}

/** תקופה כטקסט אחד לרשימת הניהול. הנצחה פתוחה: "החל מ-13.10.2026, ללא סיום" */
export function dedicationPeriodText(
  startsOn: string,
  endsOn: string | null,
): string {
  const period = dedicationPeriodLabel(startsOn, endsOn);
  if (period) return `${period.hebrew} (${period.gregorian})`;
  if (!endsOn && ISO_DATE_PATTERN.test(startsOn)) {
    return `החל מ-${gregorianLabel(startsOn)}, ללא סיום`;
  }
  return "";
}
