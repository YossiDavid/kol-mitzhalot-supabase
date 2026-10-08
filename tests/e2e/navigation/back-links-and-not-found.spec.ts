/**
 * Callers: Playwright `chromium` project (משתמש הבדיקה הוא שדכן מאושר).
 * Bug: קישורי החזרה נקראו בשמות שונים ליעד אחד ("חזרה לאפליקציה" / "חזרה ללוח
 * הבקרה"), הובילו ליעד רחב מדי (כרטיס שידוך -> לוח הבקרה במקום רשימת השידוכים),
 * ודף ה-404 היה "404" חשוף בלי דרך חזרה.
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { setShadchanApproval } from "../forums/forum-fixtures";
import {
  createServiceClient,
  deletePair,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

const LOAD_TIMEOUT = 15_000;
const MISSING_APP_PATH = "/app/no-such-page-ux-round";
const MISSING_PUBLIC_PATH = "/no-such-page-ux-round";

test.describe("קישורי חזרה ודף 404", () => {
  let admin: SupabaseClient;
  let testUserId = "";
  let fx: ShidduchFixtures;
  let shidduchId = "";

  test.beforeAll(async () => {
    admin = createServiceClient();
    testUserId = await getTestUserId(admin);
    await setShadchanApproval(admin, testUserId, "approved");
    fx = await setupShidduchFixtures(admin);
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    shidduchId = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
    });
  });

  test.afterAll(async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await teardownShidduchFixtures(admin, fx);
    await admin.from("shadchanim_info").delete().eq("user_id", testUserId);
  });

  test("כרטיס שידוך אצל השדכן שלו: חזרה ל'כל השידוכים שלי'", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/shidduchim/${shidduchId}`);
    const back = page.getByRole("link", { name: "לכל השידוכים שלי" });

    // Assert
    await expect(back).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(back).toHaveAttribute("href", "/app/shadchan/proposals");
    await expect(page.getByText("חזרה לאפליקציה")).toHaveCount(0);

    // Act
    await back.click();

    // Assert
    await expect(page).toHaveURL(/\/app\/shadchan\/proposals$/);
  });

  test("פרופיל שדכן: חזרה לרשימת השדכנים", async ({ page }) => {
    // Arrange
    await page.goto(`/app/shadchanim/${testUserId}`);
    const back = page.getByRole("link", { name: "חזרה לרשימת השדכנים" });

    // Assert
    await expect(back).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(back).toHaveAttribute("href", "/app/shadchanim");
    await expect(page.getByText("חזרה ללוח הבקרה")).toHaveCount(0);

    // Act
    await back.click();

    // Assert
    await expect(page).toHaveURL(/\/app\/shadchanim$/);
  });

  test("הצעות שקיבלתי: חזרה לעמוד הראשי", async ({ page }) => {
    // Arrange
    await page.goto("/app/proposals");
    const back = page.getByRole("link", { name: "חזרה לעמוד הראשי" });

    // Assert
    await expect(back).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(back).toHaveAttribute("href", "/app");
    await expect(page.getByText("חזרה לאפליקציה")).toHaveCount(0);

    // Act
    await back.click();

    // Assert
    await expect(page).toHaveURL(/\/app$/);
  });

  test("כל השידוכים שלי: הקישור ללוח העבודה תואם לדף ההצעות השמורות", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/shadchan/proposals");
    const toCanvas = page.getByRole("link", {
      name: "ללוח העבודה",
      exact: true,
    });

    // Assert
    await expect(toCanvas).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(toCanvas).toHaveAttribute("href", "/app/canvas");
    await expect(page.getByText("חזרה ללוח העבודה")).toHaveCount(0);
  });

  test("כתובת לא קיימת באפליקציה: 404 מוסבר עם קישור לעמוד הראשי", async ({
    page,
  }) => {
    // Act
    const response = await page.goto(MISSING_APP_PATH);

    // Assert
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText("הדף שחיפשת לא נמצא")).toBeVisible();
    const home = page.getByRole("link", { name: "חזרה לעמוד הראשי" });
    await expect(home).toHaveAttribute("href", "/app", {
      timeout: LOAD_TIMEOUT,
    });

    // Act
    await home.click();

    // Assert
    await expect(page).toHaveURL(/\/app$/);
  });

  test("כתובת לא קיימת באתר הציבורי: הקישור חוזר לדף הבית", async ({
    page,
  }) => {
    // Act
    const response = await page.goto(MISSING_PUBLIC_PATH);

    // Assert
    expect(response?.status()).toBe(404);
    const home = page.getByRole("link", { name: "חזרה לדף הבית" });
    await expect(home).toHaveAttribute("href", "/", { timeout: LOAD_TIMEOUT });
  });
});
