// פורמט זמנים לצ'אטים — מפריד תאריכים בזרם ההודעות, שעת הודעה וזמן יחסי ברשימת השיחות.

const LOCALE = "he-IL";
const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_IN_WEEK = 7;

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/**
 * כמה ימים קלנדריים עברו בין התאריך להיום. Math.round מגן ממעברי שעון
 * קיץ/חורף, שבהם יממה קלנדרית אינה בדיוק 24 שעות.
 */
function calendarDaysAgo(date: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
}

export function isSameCalendarDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

export function formatMessageTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** תווית מפריד יום: "היום" / "אתמול" / תאריך עברי מלא. */
export function formatDayLabel(dateString: string, now = new Date()): string {
  const date = new Date(dateString);
  const daysAgo = calendarDaysAgo(date, now);
  if (daysAgo <= 0) return "היום";
  if (daysAgo === 1) return "אתמול";
  return date.toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * זמן יחסי לרשימת השיחות. היום — שעה; אתמול / לפני יומיים / לפני N ימים
 * בשבוע האחרון; מעבר לכך תאריך קצר.
 */
export function formatRoomTime(
  dateString: string | null,
  now = new Date(),
): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const daysAgo = calendarDaysAgo(date, now);
  if (daysAgo <= 0) return formatMessageTime(dateString);
  if (daysAgo === 1) return "אתמול";
  if (daysAgo === 2) return "לפני יומיים";
  if (daysAgo < DAYS_IN_WEEK) return `לפני ${daysAgo} ימים`;
  return date.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "2-digit" }),
  });
}
