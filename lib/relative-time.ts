import { ISRAEL_TIME_ZONE } from "@/lib/time-zone";

/**
 * זמן יחסי בעברית ("לפני 5 דקות", "אתמול", "לפני 3 ימים"), ומעבר לחודש -
 * תאריך מלא. משמש את "נראה לאחרונה" ואת יומן הפעילות בניהול.
 */

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** מעבר לזה מוצג תאריך ולא "לפני X ימים" */
const RELATIVE_MAX_DAYS = 30;

const relativeFormat = new Intl.RelativeTimeFormat("he", { numeric: "auto" });
const dateFormat = new Intl.DateTimeFormat("he-IL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: ISRAEL_TIME_ZONE,
});
const dateTimeFormat = new Intl.DateTimeFormat("he-IL", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ISRAEL_TIME_ZONE,
});

export function formatRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const at = new Date(iso);
  const diffMs = now.getTime() - at.getTime();
  if (Number.isNaN(diffMs)) return "";
  if (diffMs < MINUTE_MS) return "עכשיו";
  if (diffMs < HOUR_MS) {
    return relativeFormat.format(-Math.floor(diffMs / MINUTE_MS), "minute");
  }
  if (diffMs < DAY_MS) {
    return relativeFormat.format(-Math.floor(diffMs / HOUR_MS), "hour");
  }
  const days = Math.floor(diffMs / DAY_MS);
  if (days <= RELATIVE_MAX_DAYS) return relativeFormat.format(-days, "day");
  return dateFormat.format(at);
}

/** התאריך והשעה המלאים - ל-title של זמן יחסי */
export function formatDateTimeIsrael(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
