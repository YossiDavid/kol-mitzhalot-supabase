import { test, expect } from "@playwright/test";

/**
 * משתמש מחובר מגיע לתוכן האתר מתוך המערכת, וכשהוא גולש באתר ההדר מחזיר
 * אותו למערכת במקום להציע לו "כניסה".
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe("משתמש מחובר", () => {
  test("בהדר האתר מופיע 'לאזור האישי' ולא כניסה והרשמה", async ({ page }) => {
    // Act
    await page.goto("/about");
    const header = page.locator("header").first();

    // Assert
    await expect(header.getByRole("link", { name: "לאזור האישי" })).toBeVisible(
      { timeout: 15_000 },
    );
    await expect(header.getByRole("link", { name: "כניסה" })).toHaveCount(0);
    await expect(header.getByRole("link", { name: "הרשמה חינם" })).toHaveCount(
      0,
    );
  });

  test("תפריט הצד כולל קישורים לתוכן האתר", async ({ page }) => {
    // Act
    await page.goto("/app");

    // Assert
    const sidebar = page.locator('[data-sidebar="content"]');
    await expect(sidebar.getByRole("link", { name: "מרכז הידע" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("במובייל: תוכן האתר זמין מתפריט המשתמש", async ({ page }) => {
    // Arrange
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/app");

    // Act
    await page.getByTitle("תפריט משתמש").click();

    // Assert
    await expect(
      page.getByRole("menuitem", { name: "מרכז הידע" }),
    ).toBeVisible();
  });

  test("במובייל: תפריט האתר מציע 'לאזור האישי'", async ({ page }) => {
    // Arrange
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/about");

    // Act
    await page.getByRole("button", { name: "תפריט" }).click();

    // Assert
    const sheet = page.getByRole("dialog");
    await expect(
      sheet.getByRole("link", { name: "לאזור האישי" }),
    ).toBeVisible();
    await expect(sheet.getByRole("link", { name: "כניסה" })).toHaveCount(0);
  });
});

test.describe("גולש לא מחובר", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("בהדר האתר מופיעה הרשמה", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.locator("header").first().getByRole("link", { name: "הרשמה חינם" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
