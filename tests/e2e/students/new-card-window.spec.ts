import { test, expect } from "@playwright/test";

import {
  newCardBadge,
  newCardsSince,
  parseNewCardsFilter,
  startOfIsraelDay,
} from "../../../features/students/lib/new-card-window";

/**
 * גבול "היום" נקבע לפי שעון ישראל (Asia/Jerusalem) ולא לפי אזור הדפדפן או
 * השרת, כולל מעבר שעון הקיץ. פונקציות טהורות - בלי דפדפן ובלי מסד.
 * בקיץ ישראל UTC+3, בחורף UTC+2; שעון הקיץ 2026 מסתיים ב-25 באוקטובר.
 */
test.describe("startOfIsraelDay", () => {
  test("בקיץ: אחרי חצות בישראל זה כבר היום החדש (21:00 UTC)", () => {
    // 00:30 ב-8 באוקטובר שעון ישראל
    const now = new Date("2026-10-07T21:30:00Z");
    expect(startOfIsraelDay(now).toISOString()).toBe(
      "2026-10-07T21:00:00.000Z",
    );
  });

  test("בקיץ: דקה לפני חצות בישראל זה עדיין היום הקודם", () => {
    const now = new Date("2026-10-07T20:59:00Z");
    expect(startOfIsraelDay(now).toISOString()).toBe(
      "2026-10-06T21:00:00.000Z",
    );
  });

  test("בחורף: חצות בישראל הוא 22:00 UTC", () => {
    const now = new Date("2026-12-15T10:00:00Z");
    expect(startOfIsraelDay(now).toISOString()).toBe(
      "2026-12-14T22:00:00.000Z",
    );
  });

  test("ביום שבו שעון הקיץ מסתיים החצות עדיין בשעון קיץ", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(startOfIsraelDay(now).toISOString()).toBe(
      "2026-10-24T21:00:00.000Z",
    );
  });
});

test.describe("newCardBadge", () => {
  const now = new Date("2026-10-08T05:00:00Z"); // 08:00 בבוקר בישראל

  test("נוצר אחרי חצות בישראל - 'היום'", () => {
    expect(newCardBadge("2026-10-07T21:00:00Z", now)).toBe("today");
  });

  test("נוצר שנייה לפני חצות בישראל - 'השבוע'", () => {
    expect(newCardBadge("2026-10-07T20:59:59Z", now)).toBe("week");
  });

  test("נוצר לפני 7 ימים ויום - לא חדש", () => {
    expect(newCardBadge("2026-09-30T04:00:00Z", now)).toBeNull();
  });

  test("created_at ריק או לא תקין - לא חדש", () => {
    expect(newCardBadge(null, now)).toBeNull();
    expect(newCardBadge(undefined, now)).toBeNull();
    expect(newCardBadge("not-a-date", now)).toBeNull();
  });
});

test.describe("newCardsSince / parseNewCardsFilter", () => {
  const now = new Date("2026-10-08T05:00:00Z");

  test("'היום' - תחילת היום בישראל", () => {
    expect(newCardsSince("today", now)).toBe("2026-10-07T21:00:00.000Z");
  });

  test("'השבוע' - 7 ימים אחורה", () => {
    expect(newCardsSince("week", now)).toBe("2026-10-01T05:00:00.000Z");
  });

  test("ערך לא מוכר נדחה", () => {
    expect(parseNewCardsFilter("today")).toBe("today");
    expect(parseNewCardsFilter("week")).toBe("week");
    expect(parseNewCardsFilter("")).toBeNull();
    expect(parseNewCardsFilter("month")).toBeNull();
    expect(parseNewCardsFilter(undefined)).toBeNull();
  });
});
