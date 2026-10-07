/**
 * Callers: Playwright `chromium` project (משתמש מחובר).
 * Bug: כפתור הכתר בהדר היה כפתור מת (console.log) בלי שם נגיש. כעת הוא קישור
 * ל-/app/premium, ושאר אייקוני ההדר נושאים שם נגיש.
 */
import { expect, test } from "@playwright/test";

const LOAD_TIMEOUT = 15_000;

test.describe("הדר: כתר הפרימיום", () => {
  test("הכתר הוא קישור נגיש לעמוד הפרימיום", async ({ page }) => {
    // Arrange
    await page.goto("/app");
    const crown = page.getByRole("link", { name: "פרימיום", exact: true });

    // Assert
    await expect(crown).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(crown).toHaveAttribute("href", "/app/premium");

    // Act
    await crown.click();

    // Assert
    await expect(page).toHaveURL(/\/app\/premium$/);
    await expect(page.getByText("מנוי הפרימיום ייפתח בקרוב")).toBeVisible();
  });

  test("קישור הבית בהדר נגיש בשמו", async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/app");

    // Assert
    await expect(
      page.getByRole("link", { name: "עמוד ראשי", exact: true }),
    ).toHaveAttribute("href", "/app");
  });
});
