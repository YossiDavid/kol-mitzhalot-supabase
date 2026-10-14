/**
 * Callers: Playwright `chromium-admin` project (מנהל מחובר).
 * "אימייל ליצירת קשר": המנהל מגדיר אותו בהגדרות המערכת, והוא מופיע בתחתית דף
 * באפליקציה, באתר הציבורי ובדפי ההתחברות (קישור mailto + כפתור "העתקה" עם
 * toast). כשההגדרה ריקה אין שורה. שינוי של מנהל מופיע מיד (הפקעת תג הקאש).
 */
import { expect, test, type Page } from "@playwright/test";

import { serviceClient } from "../helpers/dedications";

const SETTINGS_PATH = "/app/admin/settings";
const KEY = "contact_email";
const EMAIL = `info-${Date.now()}@kol-mitzhalot.test`;
const DESKTOP = { width: 1440, height: 900 };
const LOAD = { timeout: 15_000 };

const footerRow = (page: Page) => page.getByTestId("footer-contact-email");

async function saveEmail(page: Page, value: string, toastText: string) {
  await page.setViewportSize(DESKTOP);
  await page.goto(SETTINGS_PATH);
  const input = page.locator("#contact-email-input");
  await expect(input).toBeVisible(LOAD);
  await input.fill(value);
  const save = page.getByRole("button", { name: "שמירה" });
  // כפתור השמירה נעול כשהערך זהה לשמור: אין מה לשמור, והקאש כבר הופקע
  if (await save.isDisabled()) return;
  await save.click();
  await expect(page.getByText(toastText)).toBeVisible(LOAD);
}

test.describe("אימייל ליצירת קשר - הגדרה ותחתית", () => {
  let previous: string | null = null;

  test.beforeAll(async () => {
    const { data } = await serviceClient()
      .from("system_settings")
      .select("text_value")
      .eq("key", KEY)
      .maybeSingle();
    previous = data?.text_value ?? null;
  });

  test.afterAll(async () => {
    const service = serviceClient();
    if (previous) {
      await service
        .from("system_settings")
        .upsert({ key: KEY, text_value: previous });
    } else {
      await service.from("system_settings").delete().eq("key", KEY);
    }
  });

  test("כתובת לא תקינה נדחית בטופס ולא נשמרת", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(SETTINGS_PATH);
    const input = page.locator("#contact-email-input");
    await expect(input).toBeVisible(LOAD);

    await input.fill("not-an-email");
    await page.getByRole("button", { name: "שמירה" }).click();

    await expect(page.locator("#contact-email-error")).toContainText(
      "כתובת האימייל אינה תקינה",
    );
  });

  test("המנהל מגדיר: מופיע בתחתית האפליקציה, האתר ודפי ההתחברות", async ({
    page,
    browser,
  }) => {
    // Act
    await saveEmail(page, ` ${EMAIL} `, "האימייל נשמר");

    // Assert: תחתית האפליקציה (עמוד אחר באפליקציה)
    await page.goto("/app");
    const appRow = footerRow(page);
    await expect(appRow).toBeVisible(LOAD);
    await expect(appRow.getByRole("link", { name: EMAIL })).toHaveAttribute(
      "href",
      `mailto:${EMAIL}`,
    );

    // Assert: האתר הציבורי ודף התחברות, בלי סשן
    const anon = await browser.newContext({ storageState: undefined });
    try {
      const publicPage = await anon.newPage();
      for (const path of ["/about", "/auth/login"]) {
        await publicPage.goto(path);
        await expect(footerRow(publicPage)).toContainText(EMAIL, LOAD);
        await expect(
          footerRow(publicPage).getByRole("button", { name: /העתקת/ }),
        ).toBeVisible();
      }
    } finally {
      await anon.close();
    }
  });

  test("התחתית עם האימייל לא גורמת לשגיאות הידרציה בקונסול", async ({
    page: adminPage,
    browser,
    baseURL,
  }) => {
    // Arrange: דרך ההגדרה (ולא ישירות במסד), כדי שהקאש יופקע כמו אצל מנהל
    await saveEmail(adminPage, EMAIL, "האימייל נשמר");
    const context = await browser.newContext({
      storageState: undefined,
      baseURL,
    });
    const errors: string[] = [];
    try {
      const page = await context.newPage();
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      // Act
      for (const path of ["/about", "/auth/login"]) {
        await page.goto(path);
        await expect(footerRow(page)).toBeVisible(LOAD);
      }

      // Assert
      expect(
        errors.filter((text) => /hydrat|descendant|nested/i.test(text)),
      ).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("כפתור ההעתקה מעתיק ללוח ומציג toast", async ({
    page: adminPage,
    browser,
    baseURL,
  }) => {
    // Arrange: דרך ההגדרה (ולא ישירות במסד), כדי שהקאש יופקע כמו אצל מנהל
    await saveEmail(adminPage, EMAIL, "האימייל נשמר");
    const context = await browser.newContext({
      storageState: undefined,
      permissions: ["clipboard-read", "clipboard-write"],
      baseURL,
    });
    try {
      const page = await context.newPage();
      await page.goto("/auth/login");
      const button = footerRow(page).getByRole("button", { name: /העתקת/ });
      await expect(button).toBeVisible(LOAD);

      // Act
      await button.click();

      // Assert
      await expect(page.getByText("הכתובת הועתקה")).toBeVisible(LOAD);
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        EMAIL,
      );
    } finally {
      await context.close();
    }
  });

  test("הגדרה ריקה: אין שורה בתחתית, בשום מקום", async ({ page, browser }) => {
    // Act
    await saveEmail(page, "", "האימייל הוסר מהתחתית");

    // Assert
    await page.goto("/app");
    await expect(page.getByText("כל הזכויות שמורות")).toBeVisible(LOAD);
    await expect(footerRow(page)).toHaveCount(0);

    const anon = await browser.newContext({ storageState: undefined });
    try {
      const publicPage = await anon.newPage();
      for (const [path, footerText] of [
        ["/about", "כל הזכויות שמורות"],
        ["/auth/login", "חזרה לאתר"],
      ]) {
        await publicPage.goto(path);
        await expect(publicPage.getByText(footerText).first()).toBeVisible(
          LOAD,
        );
        await expect(footerRow(publicPage)).toHaveCount(0);
      }
    } finally {
      await anon.close();
    }
  });
});
