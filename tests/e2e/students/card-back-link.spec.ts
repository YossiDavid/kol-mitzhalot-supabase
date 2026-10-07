/**
 * Callers: Playwright `chromium` project (משתמש הבדיקה הוא שדכן).
 * Bug: "חזרה לרשימה" בכרטיס הוביל תמיד ל-/app/students, שחסום להורה (מסך "אין
 * גישה") ושדורש התחברות לגולש אנונימי. היעד נקבע כעת בשרת לפי הצופה.
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createCard,
  ensureSecondParentId,
  pageAs,
} from "../chats/context-fixtures";
import { createServiceClient } from "../shidduchim/fixtures";

const PARENT_EMAIL = "playwright-second-parent@kol-mitzhalot.test";
const RUN_ID = Date.now();
const LOAD_TIMEOUT = 15_000;

test.describe("קישור החזרה בכרטיס מיועד", () => {
  let admin: SupabaseClient;
  let cardId = "";

  test.beforeAll(async () => {
    admin = createServiceClient();
    const parentId = await ensureSecondParentId(admin);
    cardId = await createCard(admin, {
      userId: parentId,
      gender: "male",
      firstName: "חזרה",
      lastName: `כרטיס${RUN_ID}`,
    });
  });

  test.afterAll(async () => {
    if (cardId) await admin.from("students").delete().eq("id", cardId);
  });

  test("הורה בכרטיס שלו חוזר לעמוד הראשי ולא למסך אין גישה", async ({
    browser,
  }) => {
    // Arrange
    const page = await pageAs(
      browser,
      admin,
      PARENT_EMAIL,
      `/app/students/${cardId}`,
    );

    // Assert
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: new RegExp(`כרטיס${RUN_ID}`),
      }),
    ).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(page.getByRole("link", { name: "חזרה לרשימה" })).toHaveCount(
      0,
    );
    const back = page.getByRole("link", { name: "חזרה לעמוד הראשי" });
    await expect(back).toHaveAttribute("href", "/app");

    // Act
    await back.click();

    // Assert
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("אין לך גישה")).toHaveCount(0);

    await page.context().close();
  });

  test("שדכן עדיין חוזר לרשימת המיועדים", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${cardId}`);

    // Assert
    const back = page.getByRole("link", { name: "חזרה לרשימה" });
    await expect(back).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(back).toHaveAttribute("href", "/app/students");
    await expect(
      page.getByRole("link", { name: "חזרה לעמוד הראשי" }),
    ).toHaveCount(0);
  });

  test.describe("גולש לא מחובר (קישור שיתוף)", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("הכרטיס הציבורי בלי קישור אל תוך האפליקציה", async ({ page }) => {
      // Arrange
      await page.goto(`/app/students/${cardId}`);

      // Assert
      await expect(page.locator("h1")).toContainText(`כרטיס${RUN_ID}`, {
        timeout: LOAD_TIMEOUT,
      });
      await expect(page.getByRole("link", { name: /חזרה/ })).toHaveCount(0);
      await expect(
        page.locator('main a[href="/app/students"], main a[href="/app"]'),
      ).toHaveCount(0);
    });
  });
});
