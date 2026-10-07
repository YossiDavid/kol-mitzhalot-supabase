import { expect, test } from "@playwright/test";

/**
 * משתמש הבדיקה הוא שדכן: רשימת השדכנים והפורום זמינים לו מהתפריט, בדסקטופ
 * (סיידבר) ובמובייל (סרגל תחתון).
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe("ניווט: פורום ורשימת שדכנים", () => {
  test("בסיידבר: מעבר לפורום ולרשימת השדכנים", async ({ page }) => {
    // Arrange
    await page.goto("/app");
    const sidebar = page.locator('[data-sidebar="content"]');

    // Act
    await sidebar.getByRole("link", { name: "פורום שדכנים" }).click();

    // Assert
    await expect(page).toHaveURL(/\/app\/forums$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "פורום שדכנים" }),
    ).toBeVisible();

    // Act
    await page.goto("/app");
    await sidebar.getByRole("link", { name: "שדכנים", exact: true }).click();

    // Assert
    await expect(page).toHaveURL(/\/app\/shadchanim$/);
  });

  test("במובייל: הסרגל התחתון כולל את הפורום", async ({ page }) => {
    // Arrange
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Act
    await page.goto("/app");

    // Assert
    await expect(
      page.locator("nav").getByRole("link", { name: "פורום" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
