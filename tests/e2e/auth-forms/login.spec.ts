import { expect, test } from "@playwright/test";

/**
 * טופס ההתחברות אחרי המעבר ל-react-hook-form + zod
 * (docs/design-refactor/PLAN.md, שלב 3).
 *
 * ההתחברות המוצלחת עצמה נבדקת ב-tests/e2e/auth.setup.ts, שמייצר קישור קסם
 * ונכנס דרך /auth/confirm. כאן נבדקות רק הודעות הוולידציה, שלפני השלב הזה
 * הגיעו מהדפדפן (ובאנגלית) ולא מהמערכת.
 *
 * הבדיקה אינה יוצרת נתונים: `shouldCreateUser: false` בטופס מונע יצירת
 * חשבון לאימייל שלא קיים.
 */
test.describe("טופס התחברות", () => {
  test("שליחה בלי אימייל מציגה את הודעת השדה", async ({ page }) => {
    // Arrange
    await page.goto("/auth/login");
    await expect(
      page.getByRole("heading", { name: "התחברות" }),
    ).toBeVisible();

    // Act
    await page.getByRole("button", { name: "שלח קישור התחברות" }).click();

    // Assert
    await expect(page.getByText("נא למלא אימייל")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("אימייל לא תקין נחסם עם הודעה בעברית", async ({ page }) => {
    // Arrange
    await page.goto("/auth/login");
    const email = page.getByLabel("אימייל");

    // Act
    await email.fill("לא-אימייל");
    await page.getByRole("button", { name: "שלח קישור התחברות" }).click();

    // Assert
    await expect(page.getByText("אימייל לא תקין")).toBeVisible();
  });

  test("שדה תקין מסיר את השגיאה", async ({ page }) => {
    // Arrange
    await page.goto("/auth/login");
    await page.getByRole("button", { name: "שלח קישור התחברות" }).click();
    await expect(page.getByText("נא למלא אימייל")).toBeVisible();

    // Act
    await page.getByLabel("אימייל").fill("someone@example.com");

    // Assert
    await expect(page.getByText("נא למלא אימייל")).toHaveCount(0);
  });

  test("אימייל שאינו רשום מקבל הנחיה להירשם", async ({ page }) => {
    // Arrange
    await page.goto("/auth/login");

    // Act - חשבון שלא קיים; הטופס אינו יוצר חשבון חדש
    await page
      .getByLabel("אימייל")
      .fill(`no-such-user-${Date.now()}@kol-mitzhalot.test`);
    await page.getByRole("button", { name: "שלח קישור התחברות" }).click();

    // Assert
    await expect(
      page.getByText("לא נמצא חשבון עם האימייל הזה. יש להירשם תחילה."),
    ).toBeVisible({ timeout: 15_000 });
  });
});
