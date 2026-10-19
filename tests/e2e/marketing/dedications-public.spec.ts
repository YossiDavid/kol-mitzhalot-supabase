/**
 * Callers: Playwright `marketing` project (ללא התחברות).
 * קוביות ההקדשה בדף הבית ובדף התרומות: תוויות וטקסטים, דירוג גדלים לפי
 * bounding box, קובייה עתידית ושהסתיימה לא מוצגות, משבצת פנויה מזמינה
 * לטופס התרומה, רשת הנצחות רק כשיש, וטקסט שנראה כמו HTML מוצג כטקסט.
 *
 * הזריעה ישירה במסד (בלי פעולת ניהול), ולכן הדפים נטענים שוב עד שהקאש
 * (revalidate של 10 שניות) מתרענן. מבנה הבדיקות טורי: השלב האחרון מוחק הכול
 * ובודק את מצב ההזמנות. כל טקסט כולל מזהה ריצה ייחודי, והכול נמחק ב-afterAll.
 * ההזמנות מפנות לתרומה רגילה רק כשאין מחירי פרנס: המחירים נשמרים, נמחקים לזמן
 * הריצה ומוחזרים בסופה. גם הם נכתבים ישירות במסד (בלי הפקעת תג), ולכן הקישור
 * נבדק בטעינות חוזרות עד שקאש המחירים (revalidate של דקה) מתרענן.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  addDays,
  deleteDedicationsByPrefix,
  israelToday,
  seedDedications,
  serviceClient,
  type SeedRow,
} from "../helpers/dedications";

const RUN = `pub${Date.now()}`;
const PREFIX = `בדיקה ${RUN}`;
const today = israelToday();
const CACHE_POLL_TIMEOUT_MS = 60_000;
/** קאש מחירי הפרנס: revalidate של 60 שניות (public-dedication-prices.ts), ועוד מרווח */
const PRICES_CACHE_POLL_TIMEOUT_MS = 90_000;
const STREAM_WAIT_MS = 3_000;
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
const MEMORIAL_COUNT = 10;
const MEMORIALS_COLLAPSED_COUNT = 8;

const TEXT = {
  month: `${PREFIX} חודש`,
  week: `${PREFIX} שבוע`,
  day: `<i>${PREFIX} יום</i> &amp; בנו`,
  expired: `${PREFIX} שהסתיימה`,
  upcoming: `${PREFIX} עתידית`,
  donor: `נתרם על ידי משפחת ${RUN}`,
  note: `הערה ${RUN}`,
};

const memorialName = (index: number) => `${PREFIX} הנצחה ${index + 1}`;

const SEEDS: readonly SeedRow[] = [
  {
    kind: "sponsor_month",
    dedication_type: "לעילוי נשמת",
    honoree: TEXT.month,
    donor_line: TEXT.donor,
    note: TEXT.note,
    starts_on: addDays(today, -10),
    ends_on: addDays(today, 10),
  },
  {
    kind: "sponsor_week",
    dedication_type: "לרפואת",
    honoree: TEXT.week,
    starts_on: addDays(today, -2),
    ends_on: addDays(today, 4),
  },
  {
    kind: "sponsor_day",
    dedication_type: "לזכות",
    honoree: TEXT.day,
    starts_on: today,
    ends_on: today,
  },
  {
    kind: "sponsor_day",
    honoree: TEXT.expired,
    starts_on: addDays(today, -5),
    ends_on: addDays(today, -1),
  },
  {
    kind: "sponsor_week",
    honoree: TEXT.upcoming,
    starts_on: addDays(today, 1),
    ends_on: addDays(today, 7),
  },
  ...Array.from(
    { length: MEMORIAL_COUNT },
    (_, index): SeedRow => ({
      kind: "memorial",
      dedication_type: "לעילוי נשמת",
      honoree: memorialName(index),
      starts_on: addDays(today, -1),
      ends_on: null,
      sort_order: index,
    }),
  ),
];

// מוגבל לאזור הנראה: בפיתוח נשאר לעיתים עותק מוסתר של תוכן Suspense מחוץ לו
/**
 * רכיב לפי data-testid בתוך אזור ההקדשות, ורק הנראה: בפיתוח נשאר לעיתים
 * בתוך האזור עותק מוסתר (div hidden) של קטע ה-Suspense שהוזרם.
 */
function byTestId(page: Page, testId: string): Locator {
  return page
    .locator("#dedication-tiles")
    .locator(`[data-testid="${testId}"]`)
    .filter({ visible: true });
}

const tile = (page: Page, kind: string): Locator =>
  byTestId(page, `dedication-tile-${kind}`).filter({ hasText: RUN });

/** טוען את העמוד שוב ושוב עד שהמלל מופיע (הקאש עשוי להגיש גרסה ישנה עד revalidate) */
async function openUntilVisible(
  page: Page,
  path: string,
  marker: Locator | ((p: Page) => Locator),
  timeout = CACHE_POLL_TIMEOUT_MS,
) {
  await expect
    .poll(
      async () => {
        await page.goto(path);
        const locator = typeof marker === "function" ? marker(page) : marker;
        // isVisible ולא count: בזמן הזרמת Suspense התוכן קיים ב-DOM אך מוסתר עד החלפתו
        return locator
          .first()
          .waitFor({ state: "visible", timeout: STREAM_WAIT_MS })
          .then(
            () => true,
            () => false,
          );
      },
      { timeout, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result!;
}

// הניסיונות החוזרים מחכים להתרעננות הקאש, ולכן זמן הבדיקה ארוך מברירת המחדל
test.describe.configure({
  mode: "serial",
  timeout: CACHE_POLL_TIMEOUT_MS + 30_000,
});

const db = serviceClient();
let savedPrices: { kind: string; amount: number }[] = [];

test.describe("קוביות הקדשה באתר הציבורי", () => {
  test.beforeAll(async () => {
    const { data } = await db.from("dedication_prices").select("kind, amount");
    savedPrices = data ?? [];
    await db.from("dedication_prices").delete().neq("kind", "");
    await deleteDedicationsByPrefix(PREFIX);
    await seedDedications(SEEDS);
  });

  test.afterAll(async () => {
    await deleteDedicationsByPrefix(PREFIX);
    if (savedPrices.length > 0) {
      await db.from("dedication_prices").insert(savedPrices);
    }
  });

  for (const path of ["/", "/donations"]) {
    test(`${path}: שלוש קוביות הפרנס עם תווית, טקסט, הערה, תורם ותקופה`, async ({
      page,
    }) => {
      await page.setViewportSize(DESKTOP);
      await openUntilVisible(page, path, (p) => tile(p, "sponsor_month"));

      const section = page.locator("#dedication-tiles");
      await expect(
        section.getByRole("heading", {
          level: 2,
          name: "פרנסי היום, השבוע והחודש",
        }),
      ).toBeVisible();

      const month = tile(page, "sponsor_month");
      await expect(
        month.getByRole("heading", { level: 3, name: "פרנס החודש" }),
      ).toBeVisible();
      await expect(month).toContainText(`לעילוי נשמת ${TEXT.month}`);
      await expect(month).toContainText(TEXT.note);
      await expect(month).toContainText(TEXT.donor);
      await expect(month).toContainText("חשון"); // התקופה בתאריך עברי

      const week = tile(page, "sponsor_week");
      await expect(
        week.getByRole("heading", { level: 3, name: "פרנס השבוע" }),
      ).toBeVisible();
      await expect(week).toContainText(`לרפואת ${TEXT.week}`);

      const day = tile(page, "sponsor_day");
      await expect(
        day.getByRole("heading", { level: 3, name: "פרנס היום" }),
      ).toBeVisible();
      await expect(day).toContainText("לזכות");

      // קובייה עתידית ושהסתיימה לא מוצגות
      await expect(page.getByText(TEXT.expired)).toHaveCount(0);
      await expect(page.getByText(TEXT.upcoming)).toHaveCount(0);
    });
  }

  test("דסקטופ: חודש גדולה משבוע, ושבוע גדולה מיום (רוחב וגובה)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await openUntilVisible(page, "/", (p) => tile(p, "sponsor_day"));

    const month = await box(tile(page, "sponsor_month"));
    const week = await box(tile(page, "sponsor_week"));
    const day = await box(tile(page, "sponsor_day"));

    expect(month.width).toBeGreaterThan(week.width);
    expect(week.width).toBeGreaterThan(day.width);
    expect(month.height).toBeGreaterThan(week.height);
    expect(week.height).toBeGreaterThan(day.height);
  });

  test("מובייל: הקוביות מוערמות, חודש ראשונה, ועדיין מדורגות בגובה", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await openUntilVisible(page, "/donations", (p) => tile(p, "sponsor_day"));

    const month = await box(tile(page, "sponsor_month"));
    const week = await box(tile(page, "sponsor_week"));
    const day = await box(tile(page, "sponsor_day"));

    expect(month.y).toBeLessThan(week.y);
    expect(week.y).toBeLessThan(day.y);
    expect(month.height).toBeGreaterThan(week.height);
    expect(week.height).toBeGreaterThan(day.height);
    // בלי גלישה אופקית
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("טקסט שנראה כמו HTML מוצג כטקסט ולא נבנה כתגית", async ({ page }) => {
    await openUntilVisible(page, "/", (p) => tile(p, "sponsor_day"));
    const day = tile(page, "sponsor_day");

    await expect(day).toContainText(`<i>${PREFIX} יום</i> &amp; בנו`);
    await expect(day.locator("i")).toHaveCount(0);
  });

  test("הנצחות: רשת אחידה, עד 8 ו'לכל ההנצחות' מרחיב", async ({ page }) => {
    await openUntilVisible(page, "/", (p) =>
      byTestId(p, "dedication-tile-memorial").filter({ hasText: RUN }),
    );

    await expect(
      page.getByRole("heading", { level: 3, name: "הנצחות באתר" }),
    ).toBeVisible();
    const memorials = byTestId(page, "dedication-tile-memorial").filter({
      hasText: RUN,
    });
    await expect(memorials).toHaveCount(MEMORIALS_COLLAPSED_COUNT);

    await page
      .getByRole("button", { name: `לכל ההנצחות (${MEMORIAL_COUNT})` })
      .click();
    await expect(memorials).toHaveCount(MEMORIAL_COUNT);
    await expect(page.getByRole("button", { name: "הצג פחות" })).toBeVisible();

    // אחידות: כל ההנצחות באותו רוחב
    const widths = await memorials.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().width)),
    );
    expect(new Set(widths).size).toBe(1);
  });

  test("אחרי מחיקת הכול: שלוש הזמנות, בלי רשת הנצחות, והקישור מוביל לטופס", async ({
    page,
  }) => {
    test.setTimeout(CACHE_POLL_TIMEOUT_MS + PRICES_CACHE_POLL_TIMEOUT_MS);
    await deleteDedicationsByPrefix(PREFIX);
    await page.setViewportSize(DESKTOP);

    await openUntilVisible(page, "/", (p) =>
      byTestId(p, "dedication-available-sponsor_day"),
    );
    for (const kind of ["sponsor_month", "sponsor_week", "sponsor_day"]) {
      await expect(
        byTestId(page, `dedication-available-${kind}`),
      ).toBeVisible();
    }
    await expect(
      byTestId(page, "dedication-available-sponsor_day"),
    ).toContainText("פרנס היום פנוי");
    await expect(
      page.getByRole("heading", { name: "הנצחות באתר" }),
    ).toHaveCount(0);

    // בבית: קישור לדף התרומות, אל הטופס (בלי מחיר: לא לרכישה)
    await openUntilVisible(
      page,
      "/",
      (p) =>
        byTestId(p, "dedication-available-sponsor_week").locator(
          'a[href="/donations#donate"]',
        ),
      PRICES_CACHE_POLL_TIMEOUT_MS,
    );
    const homeCta = byTestId(
      page,
      "dedication-available-sponsor_week",
    ).getByRole("link", { name: "להקדשת השבוע" });
    await expect(homeCta).toHaveAttribute("href", "/donations#donate");

    // בדף התרומות עצמו: עוגן באותו עמוד, והטופס נגלל לתצוגה
    await page.goto("/donations");
    const cta = byTestId(page, "dedication-available-sponsor_month").getByRole(
      "link",
      { name: "להקדשת החודש" },
    );
    await expect(cta).toHaveAttribute("href", "#donate");
    await cta.click();
    await expect(page).toHaveURL(/\/donations#donate$/);
    await expect(page.locator("#donate")).toBeInViewport();
  });
});
