import { expect, test } from "@playwright/test";

/** משתמש שאינו מנהל לא מקבל את תפריט הניהול, גם לא בניסיון להיכנס ל-/app/admin */
test.describe("תפריט ניהול — לא מנהל", () => {
  test("הפניה מ-/app/admin והניווט הרגיל בלבד", async ({ page }) => {
    // Act
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app/admin");

    // Assert
    await expect(page).not.toHaveURL(/\/app\/admin(\/|$)/, { timeout: 15_000 });
    await expect(page.locator('[data-sidebar="content"]')).toBeVisible();
    await expect(page.getByTestId("admin-sidebar-nav")).toHaveCount(0);
    await expect(page.getByTestId("admin-sidebar-back")).toHaveCount(0);
  });
});
