import { expect, test } from "@playwright/test";

/**
 * טופס ההרשמה אחרי המעבר ל-react-hook-form + zod
 * (docs/design-refactor/PLAN.md, שלב 3).
 *
 * לפני השלב הזה הטופס בדק שדה אחד בכל פעם והציג הודעה אחת מעל הכפתור; עכשיו
 * כל השדות נבדקים יחד וכל הודעה יושבת מתחת לשדה שלה.
 *
 * הבדיקה אינה יוצרת חשבון: כל התרחישים נעצרים בוולידציה שבצד הלקוח.
 */
test.describe("טופס הרשמה", () => {
  test("שליחה ריקה מסמנת את כל שדות החובה בבת אחת", async ({ page }) => {
    // Arrange
    await page.goto("/auth/sign-up");
    await expect(page.getByRole("heading", { name: "הרשמה" })).toBeVisible();

    // Act
    await page.getByRole("button", { name: "הירשם" }).click();

    // Assert
    await expect(page.getByText("נא למלא שם פרטי")).toBeVisible();
    await expect(page.getByText("נא למלא שם משפחה")).toBeVisible();
    await expect(page.getByText("נא למלא אימייל")).toBeVisible();
    await expect(page.getByText("נא למלא מספר טלפון")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-up/);
  });

  test("טלפון לא תקין מציג את הודעת הטלפון של המערכת", async ({ page }) => {
    // Arrange
    await page.goto("/auth/sign-up");
    await page.getByLabel("שם פרטי").fill("ישראל");
    await page.getByLabel("שם משפחה").fill("כהן");
    await page.getByLabel("אימייל").fill("israel@example.com");

    // Act
    await page.getByLabel("מספר טלפון").fill("12");
    await page.getByRole("button", { name: "הירשם" }).click();

    // Assert
    await expect(
      page.getByText(
        "מספר טלפון לא תקין (7–15 ספרות, ניתן להוסיף קידומת בינלאומית עם +)",
      ),
    ).toBeVisible();
  });

  test("אימייל לא תקין נחסם, ושאר השדות נשארים מלאים", async ({ page }) => {
    // Arrange
    await page.goto("/auth/sign-up");
    await page.getByLabel("שם פרטי").fill("ישראל");
    await page.getByLabel("שם משפחה").fill("כהן");
    await page.getByLabel("מספר טלפון").fill("050-0000000");

    // Act
    await page.getByLabel("אימייל").fill("israel@@example");
    await page.getByRole("button", { name: "הירשם" }).click();

    // Assert
    await expect(page.getByText("אימייל לא תקין")).toBeVisible();
    await expect(page.getByLabel("שם פרטי")).toHaveValue("ישראל");
    await expect(page.getByLabel("מספר טלפון")).toHaveValue("050-0000000");
  });

  test("רווחים בלבד אינם נחשבים שם", async ({ page }) => {
    // Arrange
    await page.goto("/auth/sign-up");

    // Act
    await page.getByLabel("שם פרטי").fill("   ");
    await page.getByRole("button", { name: "הירשם" }).click();

    // Assert
    await expect(page.getByText("נא למלא שם פרטי")).toBeVisible();
  });
});
