/**
 * Callers: Playwright `chromium-admin` project (מנהל מחובר).
 * ניהול הקדשות והנצחות (/app/admin/content/dedications): תאריכי ברירת מחדל
 * לפי סוג, תצוגה מקדימה חיה, יצירה מכל סוג, פרסום והסרה, עריכה, מחיקה עם
 * דיאלוג אישור, אזהרת חפיפה, שגיאות ולידציה, הכניסה בסרגל, וחסימת משתמש
 * שאינו מנהל. השינוי מופיע באתר הציבורי מיד (הפקעת תג הקאש בפעולות השרת).
 */
import { expect, test, type Page } from "@playwright/test";

import { hebrewMonthRange } from "@/features/dedications/lib/dedication-defaults";
import { israelWeekRange } from "@/features/dedications/lib/israel-date";
import {
  addDays,
  deleteDedicationsByPrefix,
  israelToday,
  seedDedications,
} from "../helpers/dedications";

const PATH = "/app/admin/content/dedications";
const RUN = `adm${Date.now()}`;
const DESKTOP = { width: 1440, height: 900 };
const LOAD = { timeout: 15_000 };
const today = israelToday();

const label = (name: string) => `${name} ${RUN}`;

async function openAdmin(page: Page) {
  await page.setViewportSize(DESKTOP);
  await page.goto(PATH);
  await expect(
    page.getByRole("heading", { name: "הקדשות והנצחות", level: 1 }),
  ).toBeVisible(LOAD);
}

async function openNewForm(page: Page) {
  await page.getByRole("button", { name: "הוסף הקדשה" }).click();
  await expect(page.locator("form")).toBeVisible();
}

const form = (page: Page) => page.locator("form");
const kindSelect = (page: Page) => form(page).getByRole("combobox").nth(0);
const typeSelect = (page: Page) => form(page).getByRole("combobox").nth(1);
const startsOn = (page: Page) => form(page).getByLabel("מתאריך");
const endsOn = (page: Page) => form(page).getByLabel("עד תאריך (כולל)");
const honoree = (page: Page) => form(page).getByLabel("שם המוקדש");
const row = (page: Page, text: string) =>
  page.getByRole("row").filter({ hasText: text });

async function save(page: Page) {
  await form(page).getByRole("button", { name: "הוסף" }).click();
  await expect(page.locator("form")).toHaveCount(0, LOAD);
}

/** כמה זמן מותר לשינוי להגיע לאתר אחרי פעולת ניהול (הפקעת תג הקאש). ללא המתנה ל-revalidate של 10 שניות */
const PUBLIC_PROPAGATION_MS = 6_000;

/**
 * האתר הציבורי אחרי פעולת ניהול. טוענים מחדש עד שהמצב הצפוי מתקבל, בתוך
 * חלון קצר שמבדיל בין הפקעת תג (שניות בודדות) לבין המתנה לתום הקאש. במחיקה
 * נצפתה בפיתוח בקשה ראשונה שמוגשת עוד עם הנתון הישן, והשנייה כבר עדכנית.
 */
async function expectPublicTile(page: Page, text: string, isShown: boolean) {
  const tile = page.locator("#dedication-tiles").getByText(text);
  await expect
    .poll(
      async () => {
        await page.goto("/");
        await page.locator("#dedication-tiles").waitFor({ state: "visible" });
        return (await tile.count()) > 0;
      },
      { timeout: PUBLIC_PROPAGATION_MS, intervals: [300, 700, 1000] },
    )
    .toBe(isShown);
}

test.describe.configure({ mode: "serial" });

test.describe("הקדשות והנצחות (ניהול)", () => {
  test.beforeAll(async () => {
    await deleteDedicationsByPrefix(RUN);
  });

  test.afterAll(async () => {
    await deleteDedicationsByPrefix(RUN);
  });

  test("הערך בסרגל התפריט תחת 'תוכן האתר' מוביל לעמוד", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.context().addCookies([
      {
        name: "sidebar_state",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/app/admin");
    const nav = page.getByTestId("admin-sidebar-nav");
    await expect(nav).toBeVisible(LOAD);

    await nav.getByRole("button", { name: "תוכן האתר" }).click();
    await nav.getByRole("link", { name: "הקדשות והנצחות" }).click();

    await expect(page).toHaveURL(/\/app\/admin\/content\/dedications$/);
  });

  test("בחירת סוג ממלאת תאריכי ברירת מחדל וניתנת לשינוי", async ({ page }) => {
    await openAdmin(page);
    await openNewForm(page);

    // ברירת מחדל: פרנס היום
    await expect(startsOn(page)).toHaveValue(today);
    await expect(endsOn(page)).toHaveValue(today);

    await kindSelect(page).selectOption("sponsor_week");
    const week = israelWeekRange(today);
    await expect(startsOn(page)).toHaveValue(week.start);
    await expect(endsOn(page)).toHaveValue(week.end);

    await kindSelect(page).selectOption("sponsor_month");
    const month = hebrewMonthRange(today);
    await expect(startsOn(page)).toHaveValue(month.starts_on);
    await expect(endsOn(page)).toHaveValue(month.ends_on);

    await kindSelect(page).selectOption("memorial");
    await expect(startsOn(page)).toHaveValue(today);
    await expect(endsOn(page)).toHaveValue("");

    // המנהל חופשי לשנות; בחירת סוג אחרי שינוי ידני לא דורסת אותו
    await kindSelect(page).selectOption("sponsor_day");
    await endsOn(page).fill(addDays(today, 3));
    await kindSelect(page).selectOption("sponsor_week");
    await expect(endsOn(page)).toHaveValue(addDays(today, 3));
  });

  test("התצוגה המקדימה משקפת את מה שמוקלד, באותו רכיב של האתר", async ({
    page,
  }) => {
    await openAdmin(page);
    await openNewForm(page);
    const preview = page.getByTestId("dedication-preview");

    await kindSelect(page).selectOption("sponsor_month");
    await typeSelect(page).selectOption("לעילוי נשמת");
    await honoree(page).fill(label("משה בן שרה"));
    await form(page).getByLabel("שורת התורם").fill("נתרם על ידי משפחת כהן");

    await expect(
      preview.getByRole("heading", { name: "פרנס החודש" }),
    ).toBeVisible();
    await expect(preview).toContainText(`לעילוי נשמת ${label("משה בן שרה")}`);
    await expect(preview).toContainText("נתרם על ידי משפחת כהן");
    await expect(preview).toContainText("חשון");

    await kindSelect(page).selectOption("memorial");
    await expect(preview.getByTestId("dedication-tile-memorial")).toBeVisible();
  });

  const KINDS = [
    { value: "sponsor_day", title: "פרנס היום" },
    { value: "sponsor_week", title: "פרנס השבוע" },
    { value: "sponsor_month", title: "פרנס החודש" },
    { value: "memorial", title: "הנצחה" },
  ] as const;

  for (const kind of KINDS) {
    test(`יצירת ${kind.title}: מופיע ברשימה בקבוצה שלו ומוצג עכשיו`, async ({
      page,
    }) => {
      await openAdmin(page);
      await openNewForm(page);
      const text = label(`יצירה ${kind.value}`);

      await kindSelect(page).selectOption(kind.value);
      await honoree(page).fill(text);
      await save(page);

      const group = page.getByTestId(`dedication-group-${kind.value}`);
      await expect(
        group.getByRole("heading", { name: new RegExp(kind.title) }),
      ).toBeVisible(LOAD);
      await expect(row(page, text)).toContainText("מוצגת עכשיו");
    });
  }

  test("פרנס שפורסם מופיע באתר מיד; הסרה מפרסום מסירה אותו מיד", async ({
    page,
  }) => {
    await openAdmin(page);
    const text = label("יצירה sponsor_month");

    await expectPublicTile(page, text, true);

    await openAdmin(page);
    await row(page, text)
      .getByRole("button", { name: /^הסרה מפרסום/ })
      .click();
    await expect(row(page, text)).toContainText("לא מפורסמת", LOAD);
    await expectPublicTile(page, text, false);

    await openAdmin(page);
    await row(page, text)
      .getByRole("button", { name: /^פרסום/ })
      .click();
    await expect(row(page, text)).toContainText("מוצגת עכשיו", LOAD);
    await expectPublicTile(page, text, true);
  });

  test("עריכה: השינוי נשמר ומופיע ברשימה ובאתר", async ({ page }) => {
    await openAdmin(page);
    const original = label("יצירה sponsor_week");
    const edited = label("נערכה");

    await row(page, original)
      .getByRole("button", { name: /^עריכה/ })
      .click();
    await expect(honoree(page)).toHaveValue(original);
    await honoree(page).fill(edited);
    await form(page).getByRole("button", { name: "עדכן" }).click();

    await expect(page.locator("form")).toHaveCount(0, LOAD);
    await expect(row(page, edited)).toBeVisible(LOAD);
    await expect(row(page, original)).toHaveCount(0);
    await expectPublicTile(page, edited, true);
  });

  test("מחיקה: דיאלוג אישור, ביטול לא מוחק, אישור מוחק", async ({ page }) => {
    await openAdmin(page);
    const text = label("נערכה");

    await row(page, text)
      .getByRole("button", { name: /^מחיקה/ })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(text);
    await dialog.getByRole("button", { name: "ביטול" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row(page, text)).toBeVisible();

    await row(page, text)
      .getByRole("button", { name: /^מחיקה/ })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "מחק" }).click();

    await expect(row(page, text)).toHaveCount(0, LOAD);
    await expectPublicTile(page, text, false);
  });

  test("אזהרת חפיפה: הקדשה מאותו סוג בתקופה חופפת, בלי לחסום שמירה", async ({
    page,
  }) => {
    await seedDedications([
      {
        kind: "sponsor_day",
        honoree: label("חופפת"),
        starts_on: today,
        ends_on: today,
      },
    ]);
    await openAdmin(page);
    await openNewForm(page);
    const warning = page.getByTestId("dedication-overlap-warning");

    // פרנס היום, היום: חופף
    await expect(warning).toContainText(label("חופפת"));

    // תאריך אחר: אין חפיפה
    await startsOn(page).fill(addDays(today, 20));
    await endsOn(page).fill(addDays(today, 20));
    await expect(warning).toHaveCount(0);

    // חזרה לחפיפה ושמירה: מותר, שתיהן יוצגו
    await startsOn(page).fill(today);
    await endsOn(page).fill(today);
    await expect(warning).toBeVisible();
    await honoree(page).fill(label("שנייה"));
    await save(page);
    await expect(row(page, label("שנייה"))).toBeVisible(LOAD);
    await expect(row(page, label("חופפת"))).toBeVisible();
  });

  test("שגיאות ולידציה בעברית", async ({ page }) => {
    await openAdmin(page);
    await openNewForm(page);

    // שם חסר
    await form(page).getByRole("button", { name: "הוסף" }).click();
    await expect(form(page)).toContainText("נא למלא את שם המוקדש");

    // קישור בהערה
    await honoree(page).fill(label("ולידציה"));
    await form(page).getByLabel("הערה קצרה").fill("ראו https://example.com");
    await form(page).getByRole("button", { name: "הוסף" }).click();
    await expect(form(page)).toContainText("אי אפשר לכלול קישורים");
    await form(page).getByLabel("הערה קצרה").fill("");

    // פרנס בלי תאריך סיום
    await endsOn(page).fill("");
    await form(page).getByRole("button", { name: "הוסף" }).click();
    await expect(form(page)).toContainText("בפרנס נדרש תאריך סיום");

    // סיום לפני התחלה
    await endsOn(page).fill(addDays(today, -1));
    await form(page).getByRole("button", { name: "הוסף" }).click();
    await expect(form(page)).toContainText("תאריך הסיום לפני תאריך ההתחלה");

    // שם ארוך מדי
    await endsOn(page).fill(today);
    await honoree(page).fill("א".repeat(121));
    await form(page).getByRole("button", { name: "הוסף" }).click();
    await expect(form(page)).toContainText("עד 120 תווים");
    await expect(row(page, RUN).filter({ hasText: "ולידציה" })).toHaveCount(0);
  });

  test("סינון לפי סוג ולפי סטטוס", async ({ page }) => {
    await seedDedications([
      {
        kind: "memorial",
        honoree: label("מסונן עתידית"),
        starts_on: addDays(today, 9),
        ends_on: null,
      },
    ]);
    await openAdmin(page);
    await expect(row(page, label("מסונן עתידית"))).toBeVisible(LOAD);

    await page.getByLabel("סינון לפי סוג").selectOption("memorial");
    await expect(page.getByTestId("dedication-group-sponsor_day")).toHaveCount(
      0,
    );
    await expect(page.getByTestId("dedication-group-memorial")).toBeVisible();

    await page.getByLabel("סינון לפי סטטוס").selectOption("upcoming");
    await expect(row(page, label("מסונן עתידית"))).toContainText("עתידית");
    await expect(row(page, label("יצירה memorial"))).toHaveCount(0);
  });

  test("משתמש שאינו מנהל וגם אורח לא מגיעים לעמוד", async ({ browser }) => {
    const plain = await browser.newContext({
      storageState: "playwright/.auth/user.json",
      locale: "he-IL",
    });
    const plainPage = await plain.newPage();
    await plainPage.goto(PATH);
    await expect(plainPage).not.toHaveURL(
      /\/app\/admin\/content\/dedications/,
      LOAD,
    );
    await expect(
      plainPage.getByRole("heading", { name: "הקדשות והנצחות", level: 1 }),
    ).toHaveCount(0);
    await plain.close();

    const guest = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      locale: "he-IL",
    });
    const guestPage = await guest.newPage();
    await guestPage.goto(PATH);
    await expect(guestPage).not.toHaveURL(
      /\/app\/admin\/content\/dedications/,
      LOAD,
    );
    await guest.close();
  });
});
