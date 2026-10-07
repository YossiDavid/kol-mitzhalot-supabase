/** אזור הזמן שקובע את גבול "היום": ישראל, ולא הדפדפן או השרת */
export const ISRAEL_TIME_ZONE = "Asia/Jerusalem";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

/** "חדשים" בסינון: מהיום (לפי יום ישראלי) או מ-7 הימים האחרונים */
export type NewCardsFilter = "today" | "week";
/** מה מסומן על כרטיס חדש. null - הכרטיס אינו חדש */
export type NewCardBadgeKind = NewCardsFilter | null;

export const NEW_CARDS_FILTER_OPTIONS: ReadonlyArray<{
  value: NewCardsFilter;
  label: string;
}> = [
  { value: "today", label: "היום" },
  { value: "week", label: "השבוע" },
];

export const NEW_CARD_BADGE_LABELS: Record<NewCardsFilter, string> = {
  today: "חדש היום",
  week: "חדש השבוע",
};

const wallClockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ISRAEL_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** שעון הקיר בישראל ברגע נתון, כאילו היה UTC (שנה, חודש, יום, שעה...) */
function israelWallClockAsUtc(instant: Date): number {
  const parts = Object.fromEntries(
    wallClockFormat
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  );
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/** ההפרש (ms) בין שעון הקיר בישראל ל-UTC ברגע נתון; משתנה עם שעון קיץ */
function israelOffsetMs(instant: Date): number {
  // בלי אלפיות השנייה: שעון הקיר מדויק רק לשנייה
  const wholeSeconds = new Date(Math.floor(instant.getTime() / 1000) * 1000);
  return israelWallClockAsUtc(wholeSeconds) - wholeSeconds.getTime();
}

/**
 * הרגע שבו התחיל היום הנוכחי בישראל (00:00 שעון ישראל). שני מעברים: ההפרש
 * נמדד פעם ברגע הנוכחי ופעם בחצות המשוער, כדי שהיום שבו משתנה שעון הקיץ
 * ייחשב נכון.
 */
export function startOfIsraelDay(now: Date): Date {
  const wallClock = new Date(israelWallClockAsUtc(now));
  const midnightAsUtc = Date.UTC(
    wallClock.getUTCFullYear(),
    wallClock.getUTCMonth(),
    wallClock.getUTCDate(),
  );
  const firstGuess = new Date(midnightAsUtc - israelOffsetMs(now));
  return new Date(midnightAsUtc - israelOffsetMs(firstGuess));
}

/**
 * הגבול התחתון (ISO) של created_at לסינון "חדשים":
 * היום - מתחילת היום בישראל; השבוע - 7 ימים אחורה מרגע הבקשה.
 */
export function newCardsSince(filter: NewCardsFilter, now: Date): string {
  return filter === "today"
    ? startOfIsraelDay(now).toISOString()
    : new Date(now.getTime() - WEEK_DAYS * DAY_MS).toISOString();
}

/** טיפוס בטוח לערך שמגיע מבקרת הסינון (מחרוזת חופשית) */
export function parseNewCardsFilter(
  value: string | undefined,
): NewCardsFilter | null {
  return value === "today" || value === "week" ? value : null;
}

/**
 * התג של כרטיס לפי רגע היצירה: "היום" לפי יום ישראלי, "השבוע" ב-7 הימים
 * האחרונים, אחרת null. created_at ריק או לא תקין - null.
 */
export function newCardBadge(
  createdAt: string | null | undefined,
  now: Date,
): NewCardBadgeKind {
  if (!createdAt) return null;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return null;
  if (created >= startOfIsraelDay(now).getTime()) return "today";
  const weekStart = now.getTime() - WEEK_DAYS * DAY_MS;
  return created >= weekStart ? "week" : null;
}
