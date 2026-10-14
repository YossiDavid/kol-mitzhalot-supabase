import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { createAdminClient, deleteTestUserByEmail } from "./auth-test-helpers";

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

  test("בחירת 'להצטרף כשדכן' מציגה הסבר על טופס ההצטרפות בהגדרות", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/auth/sign-up");
    const note = page.getByTestId("shadchan-purpose-note");
    await expect(note).toHaveCount(0);

    // Act - הבחירה נחזרת אם נעשתה לפני שההידרציה הסתיימה, ולכן חוזרים עליה
    await expect(async () => {
      await page
        .getByLabel("מטרת ההרשמה")
        .selectOption({ label: "אני רוצה להצטרף כשדכן/ית" });
      await expect(note).toBeVisible({ timeout: 1000 });
    }).toPass();

    // Assert
    await expect(note).toBeVisible();
    await expect(note).toContainText("הגדרות");
    await expect(note).toContainText("הצטרפות כשדכן");

    // Act - מטרה אחרת מסתירה את ההסבר
    await page
      .getByLabel("מטרת ההרשמה")
      .selectOption({ label: "אני מחפש/ת שידוך לעצמי" });

    // Assert
    await expect(note).toHaveCount(0);
  });

  test("בחירת 'להצטרף כאיש צוות' מציגה הסבר על ההצטרפות כאיש צוות", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/auth/sign-up");
    const note = page.getByTestId("staff-purpose-note");
    await expect(note).toHaveCount(0);

    // Act
    await expect(async () => {
      await page
        .getByLabel("מטרת ההרשמה")
        .selectOption({ label: "אני רוצה להצטרף כאיש צוות" });
      await expect(note).toBeVisible({ timeout: 1000 });
    }).toPass();

    // Assert
    await expect(note).toContainText("הגדרות");
    await expect(note).toContainText("הצטרפות כאיש צוות");
    await expect(page.getByTestId("shadchan-purpose-note")).toHaveCount(0);
  });

  test("'אחר' מציג שדה טקסט חובה: ריק, קצר וקישור נדחים", async ({ page }) => {
    // Arrange
    await page.goto("/auth/sign-up");
    const otherField = page.getByLabel("פרטו את המטרה");
    await expect(otherField).toHaveCount(0);
    await page.getByLabel("שם פרטי").fill("ישראל");
    await page.getByLabel("שם משפחה").fill("כהן");
    await page.getByLabel("אימייל").fill("israel@example.com");
    await page.getByLabel("מספר טלפון").fill("050-0000000");
    await expect(async () => {
      await page.getByLabel("מטרת ההרשמה").selectOption({ label: "אחר" });
      await expect(otherField).toBeVisible({ timeout: 1000 });
    }).toPass();

    // Act + Assert: ריק
    await page.getByRole("button", { name: "הירשם" }).click();
    await expect(page.getByText("נא לפרט את מטרת ההרשמה")).toBeVisible();

    // תו אחד
    await otherField.fill("א");
    await page.getByRole("button", { name: "הירשם" }).click();
    await expect(page.getByText("נא לפרט (לפחות 2 תווים)")).toBeVisible();

    // קישור
    await otherField.fill("ראו https://example.com");
    await page.getByRole("button", { name: "הירשם" }).click();
    await expect(page.getByText("אי אפשר לכלול קישורים")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-up/);

    // מטרה אחרת מסתירה את השדה
    await page
      .getByLabel("מטרת ההרשמה")
      .selectOption({ label: "אני מחפש/ת שידוך לעצמי" });
    await expect(otherField).toHaveCount(0);
  });

  test("הרשמה עם 'אחר': המטרה והטקסט נשמרים במטא-דאטה של המשתמש", async ({
    page,
  }) => {
    // Arrange
    const email = `signup-other-${randomUUID()}@kol-mitzhalot.test`;
    const phone = `05${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await page.goto("/auth/sign-up");
    await page.getByLabel("שם פרטי").fill("אחר");
    await page.getByLabel("שם משפחה").fill("בדיקה");
    await page.getByLabel("אימייל").fill(email);
    await page.getByLabel("מספר טלפון").fill(phone);
    await expect(async () => {
      await page.getByLabel("מטרת ההרשמה").selectOption({ label: "אחר" });
      await expect(page.getByLabel("פרטו את המטרה")).toBeVisible({
        timeout: 1000,
      });
    }).toPass();
    await page.getByLabel("פרטו את המטרה").fill("  רוצה להתנדב  ");

    try {
      // Act
      await page.getByRole("button", { name: "הירשם" }).click();
      await expect(page).toHaveURL(/\/auth\/check-email/, { timeout: 15_000 });

      // Assert
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const user = data?.users.find((candidate) => candidate.email === email);
      expect(user?.user_metadata).toMatchObject({
        signup_purpose: "other",
        signup_purpose_other: "רוצה להתנדב",
      });
    } finally {
      await deleteTestUserByEmail(email);
    }
  });

  test("הרשמה כאיש צוות: נשמרת המטרה, בלי טקסט חופשי", async ({ page }) => {
    // Arrange
    const email = `signup-staff-${randomUUID()}@kol-mitzhalot.test`;
    const phone = `05${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await page.goto("/auth/sign-up");
    await page.getByLabel("שם פרטי").fill("צוות");
    await page.getByLabel("שם משפחה").fill("בדיקה");
    await page.getByLabel("אימייל").fill(email);
    await page.getByLabel("מספר טלפון").fill(phone);
    await expect(async () => {
      await page
        .getByLabel("מטרת ההרשמה")
        .selectOption({ label: "אני רוצה להצטרף כאיש צוות" });
      await expect(page.getByTestId("staff-purpose-note")).toBeVisible({
        timeout: 1000,
      });
    }).toPass();

    try {
      // Act
      await page.getByRole("button", { name: "הירשם" }).click();
      await expect(page).toHaveURL(/\/auth\/check-email/, { timeout: 15_000 });

      // Assert
      const { data } = await createAdminClient().auth.admin.listUsers({
        perPage: 1000,
      });
      const user = data?.users.find((candidate) => candidate.email === email);
      expect(user?.user_metadata.signup_purpose).toBe("staff");
      expect(user?.user_metadata).not.toHaveProperty("signup_purpose_other");
    } finally {
      await deleteTestUserByEmail(email);
    }
  });
});
