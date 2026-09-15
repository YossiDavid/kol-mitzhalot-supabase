import { test, expect } from "@playwright/test";

/**
 * בורר הפיתוח באשף הקו״ח: מעבר בין שלבים בלי למלא שדות חובה.
 * הבדיקות רצות מול pnpm dev (NODE_ENV=development), ולכן הבורר מוצג.
 * ב-production הדגל מוחלף בזמן הבנייה ב-false והבורר לא קיים.
 */

const SWITCH_NAME = "מעבר בין שלבים בלי ולידציה (development בלבד)";

test.describe("דילוג על ולידציית שלבים ב-development", () => {
  test("כבוי כברירת מחדל: השלב נחסם כמו תמיד", async ({ page }) => {
    // Arrange
    await page.goto("/app/students/create");
    const devSwitch = page.getByRole("switch", { name: SWITCH_NAME });

    // Act
    await page.getByRole("button", { name: "המשך לשלב הבא" }).click();

    // Assert
    await expect(devSwitch).not.toBeChecked();
    await expect(page.getByText("נא לבחור מיועד/מיועדת")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "פרטים אישיים" }),
    ).toHaveCount(0);
  });

  test("דלוק: עוברים בין שלבים בלי למלא, והבחירה נשמרת ברענון", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/students/create");
    const devSwitch = page.getByRole("switch", { name: SWITCH_NAME });
    await devSwitch.click();
    await expect(devSwitch).toBeChecked();

    // Act: "הבא" בהקדמה בלי מגדר, ואז קפיצה בניווט לשלב מאוחר
    await page.getByRole("button", { name: "המשך לשלב הבא" }).click();
    await expect(
      page.getByRole("heading", { name: "פרטים אישיים" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "המשך לשלב הבא" }).click();
    await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button", { name: "פרטים נוספים", exact: true })
      .click();

    // Assert
    await expect(
      page.getByRole("heading", { name: "פרטים נוספים" }),
    ).toBeVisible();
    await expect(
      page.locator('p.text-destructive[id$="-message"]'),
    ).toHaveCount(0);

    // Act
    await page.reload();

    // Assert
    await expect(page.getByRole("switch", { name: SWITCH_NAME })).toBeChecked();
  });
});
