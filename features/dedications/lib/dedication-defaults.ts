/**
 * ברירות מחדל לתאריכים כשהמנהל בוחר סוג קובייה (הוא חופשי לשנות):
 * יום = היום; שבוע = ראשון עד שבת; חודש = החודש העברי הנוכחי (ראשון עד אחרון).
 */
import { calcDaysInMonth, toGregorianDate, toJewishDate } from "jewish-date";

import { localNoon } from "@/features/dedications/lib/dedication-period";
import type { DedicationKind } from "@/features/dedications/lib/dedication-model";
import { israelWeekRange } from "@/features/dedications/lib/israel-date";

export interface DefaultDates {
  starts_on: string;
  ends_on: string;
}

function toLocalIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** ראשון ואחרון בחודש העברי שבו נמצא התאריך */
export function hebrewMonthRange(iso: string): DefaultDates {
  const { year, monthName } = toJewishDate(localNoon(iso));
  const lastDay = calcDaysInMonth(year, monthName);
  return {
    starts_on: toLocalIso(toGregorianDate({ day: 1, monthName, year })),
    ends_on: toLocalIso(toGregorianDate({ day: lastDay, monthName, year })),
  };
}

/** תאריכי ברירת המחדל לסוג; להנצחה: מהיום ובלי סיום (פתוחה) */
export function defaultDatesForKind(
  kind: DedicationKind,
  today: string,
): { starts_on: string; ends_on: string } {
  switch (kind) {
    case "sponsor_day":
      return { starts_on: today, ends_on: today };
    case "sponsor_week": {
      const { start, end } = israelWeekRange(today);
      return { starts_on: start, ends_on: end };
    }
    case "sponsor_month":
      return hebrewMonthRange(today);
    case "memorial":
      return { starts_on: today, ends_on: "" };
  }
}
