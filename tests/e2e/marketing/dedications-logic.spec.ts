/**
 * Callers: Playwright `marketing` project (בדיקות יחידה, בלי דפדפן ובלי מסד).
 * הלוגיקה הטהורה של קוביות ההקדשה: "היום בישראל" סביב חצות ומעבר שעון קיץ,
 * חלון התקופה, חפיפות, ברירות מחדל לתאריכים, תצוגת התקופה והסכמה.
 */
import { expect, test } from "@playwright/test";

import { defaultDatesForKind } from "@/features/dedications/lib/dedication-defaults";
import {
  dedicationPeriodLabel,
  dedicationPeriodText,
} from "@/features/dedications/lib/dedication-period";
import { dedicationFormSchema } from "@/features/dedications/lib/dedication-schema";
import { dedicationStatus } from "@/features/dedications/lib/dedication-status";
import {
  addDays,
  isCurrentInIsrael,
  isValidIsoDate,
  israelDateOf,
  israelWeekRange,
  rangesOverlap,
} from "@/features/dedications/lib/israel-date";

const validForm = {
  kind: "sponsor_day" as const,
  dedication_type: "לעילוי נשמת" as const,
  honoree: "משה בן שרה",
  donor_line: "",
  note: "",
  starts_on: "2026-10-13",
  ends_on: "2026-10-13",
  sort_order: "0",
  is_published: true,
};

test.describe("היום בישראל (israelDateOf)", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["שעון קיץ: דקה לפני חצות ישראלי", "2026-10-13T20:59:59Z", "2026-10-13"],
    ["שעון קיץ: חצות ישראלי בדיוק", "2026-10-13T21:00:00Z", "2026-10-14"],
    [
      "02:00 בלילה בישראל (UTC עדיין אתמול)",
      "2026-10-13T23:00:00Z",
      "2026-10-14",
    ],
    ["שעון חורף: דקה לפני חצות ישראלי", "2026-12-13T21:59:59Z", "2026-12-13"],
    ["שעון חורף: חצות ישראלי בדיוק", "2026-12-13T22:00:00Z", "2026-12-14"],
    // סוף שעון הקיץ 2026: ראשון 25.10 ב-02:00 חוזרים ל-01:00
    [
      "לילה של סוף שעון הקיץ: חצות 25.10 (עדיין קיץ)",
      "2026-10-24T21:00:00Z",
      "2026-10-25",
    ],
    [
      "לילה של סוף שעון הקיץ: 23:59 ב-25.10 (כבר חורף)",
      "2026-10-25T21:59:59Z",
      "2026-10-25",
    ],
    ["לילה של סוף שעון הקיץ: חצות 26.10", "2026-10-25T22:00:00Z", "2026-10-26"],
    // תחילת שעון הקיץ 2026: שישי 27.3 ב-02:00 קופצים ל-03:00
    [
      "תחילת שעון הקיץ: חצות 27.3 (עוד חורף)",
      "2026-03-26T22:00:00Z",
      "2026-03-27",
    ],
    [
      "תחילת שעון הקיץ: 23:59 ב-27.3 (כבר קיץ)",
      "2026-03-27T20:59:59Z",
      "2026-03-27",
    ],
    ["תחילת שעון הקיץ: חצות 28.3", "2026-03-27T21:00:00Z", "2026-03-28"],
    ["מעבר שנה אזרחית", "2026-12-31T22:00:00Z", "2027-01-01"],
  ];

  for (const [name, instant, expected] of cases) {
    test(name, () => {
      expect(israelDateOf(new Date(instant))).toBe(expected);
    });
  }
});

test.describe("חלון התקופה", () => {
  const range = { starts_on: "2026-10-13", ends_on: "2026-10-15" };

  test("היום הראשון והאחרון נכללים; יום לפני ויום אחרי לא", () => {
    expect(isCurrentInIsrael(range, "2026-10-12")).toBe(false);
    expect(isCurrentInIsrael(range, "2026-10-13")).toBe(true);
    expect(isCurrentInIsrael(range, "2026-10-15")).toBe(true);
    expect(isCurrentInIsrael(range, "2026-10-16")).toBe(false);
  });

  test("הנצחה פתוחה (בלי סיום) נשארת בתוקף עד סוף הזמן", () => {
    const open = { starts_on: "2026-10-13", ends_on: null };
    expect(isCurrentInIsrael(open, "2026-10-12")).toBe(false);
    expect(isCurrentInIsrael(open, "2040-01-01")).toBe(true);
  });

  test("קובייה ליום אחד נשארת עד חצות ישראלי ונעלמת אחריו", () => {
    const today = { starts_on: "2026-10-13", ends_on: "2026-10-13" };
    const before = israelDateOf(new Date("2026-10-13T20:59:59Z"));
    const after = israelDateOf(new Date("2026-10-13T21:00:00Z"));
    expect(isCurrentInIsrael(today, before)).toBe(true);
    expect(isCurrentInIsrael(today, after)).toBe(false);
  });

  test("חפיפות", () => {
    expect(
      rangesOverlap(range, { starts_on: "2026-10-15", ends_on: "2026-10-20" }),
    ).toBe(true);
    expect(
      rangesOverlap(range, { starts_on: "2026-10-16", ends_on: "2026-10-20" }),
    ).toBe(false);
    expect(
      rangesOverlap(range, { starts_on: "2026-10-01", ends_on: null }),
    ).toBe(true);
  });

  test("סטטוס בניהול: לא מפורסמת גוברת על התאריכים", () => {
    const today = "2026-10-13";
    expect(dedicationStatus({ ...range, is_published: true }, today)).toBe(
      "current",
    );
    expect(dedicationStatus({ ...range, is_published: false }, today)).toBe(
      "unpublished",
    );
    expect(
      dedicationStatus(
        { starts_on: "2026-10-14", ends_on: "2026-10-14", is_published: true },
        today,
      ),
    ).toBe("upcoming");
    expect(
      dedicationStatus(
        { starts_on: "2026-10-01", ends_on: "2026-10-12", is_published: true },
        today,
      ),
    ).toBe("past");
  });
});

test.describe("תאריכים", () => {
  test("חשבון ימים חוצה חודש ושנה", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("תאריך לא קיים נדחה", () => {
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("13/10/2026")).toBe(false);
    expect(isValidIsoDate("2026-10-13")).toBe(true);
  });

  test("שבוע ישראלי: ראשון עד שבת, ושבת שייכת לשבוע שמסתיים בה", () => {
    expect(israelWeekRange("2026-10-13")).toEqual({
      start: "2026-10-11",
      end: "2026-10-17",
    });
    expect(israelWeekRange("2026-10-11")).toEqual({
      start: "2026-10-11",
      end: "2026-10-17",
    });
    expect(israelWeekRange("2026-10-17")).toEqual({
      start: "2026-10-11",
      end: "2026-10-17",
    });
    expect(israelWeekRange("2026-10-18")).toEqual({
      start: "2026-10-18",
      end: "2026-10-24",
    });
  });

  test("ברירות מחדל: יום, שבוע, חודש עברי והנצחה פתוחה", () => {
    const today = "2026-10-13"; // ב׳ חשון תשפ״ז
    expect(defaultDatesForKind("sponsor_day", today)).toEqual({
      starts_on: today,
      ends_on: today,
    });
    expect(defaultDatesForKind("sponsor_week", today)).toEqual({
      starts_on: "2026-10-11",
      ends_on: "2026-10-17",
    });
    // חשון תשפ״ז: א׳ חשון = 12.10.2026, ל׳ חשון = 10.11.2026
    expect(defaultDatesForKind("sponsor_month", today)).toEqual({
      starts_on: "2026-10-12",
      ends_on: "2026-11-10",
    });
    expect(defaultDatesForKind("memorial", today)).toEqual({
      starts_on: today,
      ends_on: "",
    });
  });

  test("תצוגת תקופה: עברי ראשי ולועזי משני", () => {
    expect(dedicationPeriodLabel("2026-10-13", "2026-10-13")).toEqual({
      hebrew: "ב׳ חשון התשפ״ז",
      gregorian: "13.10.2026",
    });
    const week = dedicationPeriodLabel("2026-10-11", "2026-10-17");
    expect(week?.hebrew).toContain("חשון");
    expect(week?.gregorian).toBe("11.10 – 17.10.2026");
    expect(dedicationPeriodLabel("2026-10-13", null)).toBeNull();
    expect(dedicationPeriodText("2026-10-13", null)).toBe(
      "החל מ-13.10.2026, ללא סיום",
    );
  });
});

test.describe("סכמת הטופס", () => {
  test("קלט תקין עובר", () => {
    expect(dedicationFormSchema.safeParse(validForm).success).toBe(true);
  });

  test("פרנס בלי תאריך סיום נדחה, הנצחה פתוחה מותרת", () => {
    const sponsor = dedicationFormSchema.safeParse({
      ...validForm,
      ends_on: "",
    });
    expect(sponsor.success).toBe(false);
    const memorial = dedicationFormSchema.safeParse({
      ...validForm,
      kind: "memorial",
      ends_on: "",
    });
    expect(memorial.success).toBe(true);
  });

  test("סיום לפני התחלה נדחה", () => {
    const result = dedicationFormSchema.safeParse({
      ...validForm,
      ends_on: "2026-10-12",
    });
    expect(result.success).toBe(false);
  });

  test("שם ריק, ארוך מדי וקישורים נדחים", () => {
    expect(
      dedicationFormSchema.safeParse({ ...validForm, honoree: "   " }).success,
    ).toBe(false);
    expect(
      dedicationFormSchema.safeParse({ ...validForm, honoree: "א".repeat(121) })
        .success,
    ).toBe(false);
    expect(
      dedicationFormSchema.safeParse({ ...validForm, note: "ב".repeat(201) })
        .success,
    ).toBe(false);
    expect(
      dedicationFormSchema.safeParse({
        ...validForm,
        note: "ראו https://example.com",
      }).success,
    ).toBe(false);
    expect(
      dedicationFormSchema.safeParse({
        ...validForm,
        donor_line: "www.example.com",
      }).success,
    ).toBe(false);
  });

  test("טקסט שנראה כמו HTML מותר: הוא יוצג כטקסט", () => {
    expect(
      dedicationFormSchema.safeParse({
        ...validForm,
        honoree: "<b>משה</b> & בנו",
      }).success,
    ).toBe(true);
  });
});
