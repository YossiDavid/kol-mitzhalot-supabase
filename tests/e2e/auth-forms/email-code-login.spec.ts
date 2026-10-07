import { expect, test } from "@playwright/test";

import {
  createTestUser,
  deleteTestUserByEmail,
  expectLandedOn,
  generateEmailCredentials,
  readLatestEmailLink,
  type TestUser,
  waitForEmail,
} from "./auth-test-helpers";

/**
 * הקוד בן 6 הספרות שבמייל הוא הגיבוי לקישור שנצרך מראש: מסך "בדוק את
 * האימייל" ודף השגיאה מציעים אותו, והוא מכניס בלי לבקש מייל חדש.
 */

let user: TestUser;
const createdEmails: string[] = [];

test.beforeEach(async () => {
  user = await createTestUser();
  createdEmails.push(user.email);
});

test.afterEach(async () => {
  while (createdEmails.length) {
    await deleteTestUserByEmail(createdEmails.pop()!);
  }
});

test.describe("כניסה עם קוד מהמייל", () => {
  test("טופס ההתחברות שולח מייל ומציג את הכניסה עם קוד, והקוד מכניס", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/auth/login");
    await page.getByLabel("אימייל").fill(user.email);

    // Act
    await page.getByRole("button", { name: "שלח קישור התחברות" }).click();
    await expect(page).toHaveURL(/\/auth\/check-email/);
    await expect(page.getByText("הזנת קוד מהמייל")).toBeVisible();
    await waitForEmail(user.email);
    // התבנית המקומית אינה נושאת קוד, ולכן הקוד נוצר כמו ש-{{ .Token }} היה נושא
    const { code } = await generateEmailCredentials(user.email);
    // שדה הקוד קיים רק במסך החדש; ממתינים לו לפני בדיקת האימייל שמולא מראש
    const codeField = page.getByLabel("הקוד בן 6 הספרות");
    await expect(codeField).toBeVisible();
    // (דף ההתחברות נשאר מוסתר ב-DOM, ולכן מצמצמים לאזור הקוד)
    const codeRegion = page.getByRole("region", { name: "הזנת קוד מהמייל" });
    await expect(codeRegion.getByLabel("אימייל")).toHaveValue(user.email);
    await codeField.fill(code);
    await page.getByRole("button", { name: "כניסה עם הקוד" }).click();

    // Assert
    await expectLandedOn(page, "/app");
  });

  test("קישור המייל בצורה הישנה (כתובת האימות של Supabase) עדיין נכנס, ורק בלחיצה", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/auth/login");
    await page.getByLabel("אימייל").fill(user.email);
    await page.getByRole("button", { name: "שלח קישור התחברות" }).click();
    await expect(page).toHaveURL(/\/auth\/check-email/);
    const link = await readLatestEmailLink(user.email);

    // Act - אותו דפדפן שביקש את הקישור (PKCE); Supabase מפנה אלינו עם code
    await page.goto(link);
    await expect(page).toHaveURL(/\/auth\/confirm\?code=/);
    await expect(
      page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }).click();

    // Assert
    await expectLandedOn(page, "/app");
  });

  test("הרשמה חדשה: הקישור במייל ואז הקוד משלימים את ההרשמה", async ({
    page,
  }) => {
    // Arrange
    const email = `auth-signup-${Date.now()}@kol-mitzhalot.test`;
    createdEmails.push(email);
    await page.goto("/auth/sign-up");
    await page.getByLabel("שם פרטי").fill("חדש");
    await page.getByLabel("שם משפחה").fill("נרשם");
    await page.getByLabel("אימייל").fill(email);
    await page
      .getByLabel("מספר טלפון")
      .fill(`050${String(Date.now()).slice(-7)}`);
    await page.getByLabel("מטרת ההרשמה").selectOption("self");

    // Act
    await page.getByRole("button", { name: "הירשם" }).click();
    await expect(page).toHaveURL(/\/auth\/check-email/, { timeout: 15_000 });
    await page.goto(await readLatestEmailLink(email));
    await page
      .getByRole("button", { name: "אישור וכניסה" })
      .or(page.getByRole("button", { name: "לחצו כדי להיכנס למערכת" }))
      .click();

    // Assert - נכנס למערכת (או נשלח לשלבי הטלפון/השם שאחרי הכניסה)
    await expect(page).toHaveURL(
      (url) =>
        url.pathname.startsWith("/app") ||
        url.pathname.startsWith("/auth/verify-phone"),
      { timeout: 15_000 },
    );
  });

  test("הקוד נכנס גם מדף השגיאה, כשהקישור כבר נוצל", async ({ page }) => {
    // Arrange
    const { code } = await generateEmailCredentials(user.email);
    await page.goto(
      "/auth/error?code=otp_expired&error=Email%20link%20is%20invalid%20or%20has%20expired",
    );

    // Act
    await page.getByLabel("אימייל").fill(user.email);
    await page
      .getByLabel("הקוד בן 6 הספרות")
      .fill(` ${code.slice(0, 3)} ${code.slice(3)} `);
    await page.getByRole("button", { name: "כניסה עם הקוד" }).click();

    // Assert
    await expectLandedOn(page, "/app");
  });

  test("קוד שגוי מציג הודעה בעברית ולא מכניס", async ({ page }) => {
    // Arrange
    await generateEmailCredentials(user.email);
    await page.goto("/auth/check-email");

    // Act
    await page.getByLabel("אימייל").fill(user.email);
    await page.getByLabel("הקוד בן 6 הספרות").fill("000000");
    await page.getByRole("button", { name: "כניסה עם הקוד" }).click();

    // Assert
    await expect(page.getByText(/הקוד שגוי או שפג תוקפו/)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/check-email/);
  });

  test("קוד קצר מדי נחסם בצד הלקוח", async ({ page }) => {
    // Arrange
    await page.goto("/auth/check-email");
    await page.getByLabel("אימייל").fill("someone@example.com");

    // Act
    await page.getByLabel("הקוד בן 6 הספרות").fill("123");
    await page.getByRole("button", { name: "כניסה עם הקוד" }).click();

    // Assert
    await expect(page.getByText("הקוד מורכב מ-6 ספרות")).toBeVisible();
  });
});
