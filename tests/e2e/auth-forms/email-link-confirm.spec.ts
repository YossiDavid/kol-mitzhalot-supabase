import { expect, test, type Page } from "@playwright/test";

import {
  createTestUser,
  expectLandedOn,
  deleteTestUserByEmail,
  generateEmailCredentials,
  magicLinkPath,
  type TestUser,
} from "./auth-test-helpers";

/**
 * קישור הכניסה במייל חייב לשרוד סורקי קישורים (מסנני אינטרנט, הגנת Gmail)
 * שפותחים אותו מראש: ה-GET רק מציג כפתור, והאסימון נצרך בלחיצה. כשבכל זאת
 * הקישור נוצל, המשתמש מקבל הסבר בעברית ודרך כניסה בלי לבקש מייל חדש.
 */

const CONFIRM_BUTTON = "לחצו כדי להיכנס למערכת";
const EXPIRED_EXPLANATION = /הקישור כבר נוצל, פג תוקפו/;
const ENGLISH_PROVIDER_TEXT = /invalid|expired|verifier|Signups/i;

let user: TestUser;

test.beforeEach(async () => {
  user = await createTestUser();
});

test.afterEach(async () => {
  await deleteTestUserByEmail(user.email);
});

async function expectExpiredPage(page: Page) {
  await expect(page).toHaveURL(/\/auth\/error/);
  await expect(page.getByText(EXPIRED_EXPLANATION)).toBeVisible();
  await expect(page.getByText("הזנת קוד מהמייל")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "בקשת קישור חדש" }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(ENGLISH_PROVIDER_TEXT);
}

test.describe("קישור במייל מול סורק קישורים", () => {
  test("בקשת GET של סורק לא צורכת את הקישור, והלחיצה שאחריה מכניסה", async ({
    page,
    request,
  }) => {
    // Arrange
    const { tokenHash } = await generateEmailCredentials(user.email);
    const path = magicLinkPath(tokenHash);

    // Act - הסורק פותח את הכתובת פעמיים בלי ללחוץ על דבר
    const scan1 = await request.get(path);
    const scan2 = await request.get(path);
    await page.goto(path);
    await page.getByRole("button", { name: CONFIRM_BUTTON }).click();

    // Assert
    expect(scan1.ok()).toBe(true);
    expect(await scan1.text()).toContain("לחצו כדי להיכנס למערכת");
    expect(scan2.ok()).toBe(true);
    await expectLandedOn(page, "/app");
  });

  test("הקישור חד-פעמי: פתיחה שנייה אחרי כניסה מציגה הסבר בעברית", async ({
    page,
    browser,
  }) => {
    // Arrange
    const { tokenHash } = await generateEmailCredentials(user.email);
    const path = magicLinkPath(tokenHash);
    await page.goto(path);
    await page.getByRole("button", { name: CONFIRM_BUTTON }).click();
    await expectLandedOn(page, "/app");

    // Act - הקישור נפתח שוב, בדפדפן נקי
    const second = await browser.newPage();
    await second.goto(path);
    await second.getByRole("button", { name: CONFIRM_BUTTON }).click();

    // Assert
    await expectExpiredPage(second);
    await second.close();
  });

  test("אסימון לא תקין מציג את אותו הסבר, בלי טקסט אנגלי", async ({ page }) => {
    // Act
    await page.goto(magicLinkPath("garbage-token"));
    await page.getByRole("button", { name: CONFIRM_BUTTON }).click();

    // Assert
    await expectExpiredPage(page);
  });
});

test.describe("צורות הקישור שכבר נשלחו", () => {
  test("הצורה הקלאסית עם ?next= מחזירה ליעד", async ({ page }) => {
    // Arrange
    const { tokenHash } = await generateEmailCredentials(user.email);

    // Act
    await page.goto(magicLinkPath(tokenHash, { next: "/app/settings" }));
    await page.getByRole("button", { name: CONFIRM_BUTTON }).click();

    // Assert
    await expectLandedOn(page, "/app/settings");
  });

  test("הצורה עם היעד בנתיב (קישור עמוק) מחזירה ליעד", async ({ page }) => {
    // Arrange
    const { tokenHash } = await generateEmailCredentials(user.email);

    // Act
    await page.goto(
      `/auth/confirm/app/settings?token_hash=${tokenHash}&type=magiclink`,
    );
    await page.getByRole("button", { name: CONFIRM_BUTTON }).click();

    // Assert
    await expectLandedOn(page, "/app/settings");
  });

  test("יעד חיצוני ב-next לא מוציא מהאתר", async ({ page }) => {
    // Arrange
    const { tokenHash } = await generateEmailCredentials(user.email);

    // Act
    await page.goto(
      magicLinkPath(tokenHash, { next: "https://evil.example/steal" }),
    );
    await page.getByRole("button", { name: CONFIRM_BUTTON }).click();

    // Assert
    await expectLandedOn(page, "/app");
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("קישור הרשמה (type=signup) מציג נוסח אישור הרשמה", async ({ page }) => {
    // Act
    await page.goto(magicLinkPath("whatever", { type: "signup" }));

    // Assert
    await expect(
      page.getByRole("heading", { name: "אישור הרשמה" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "אישור וכניסה" }),
    ).toBeVisible();
  });

  test("קישור PKCE ישן (?code=) מציג כפתור ולא צורך בטעינה", async ({
    page,
  }) => {
    // Act
    await page.goto("/auth/confirm?code=not-a-real-code");
    await expect(
      page.getByRole("button", { name: CONFIRM_BUTTON }),
    ).toBeVisible();
    await page.getByRole("button", { name: CONFIRM_BUTTON }).click();

    // Assert - קוד שגוי: הסבר בעברית, בלי טקסט הספק
    await expect(page).toHaveURL(/\/auth\/error/);
    await expect(page.locator("main")).not.toContainText(ENGLISH_PROVIDER_TEXT);
    await expect(page.getByText("הזנת קוד מהמייל")).toBeVisible();
  });

  test("שגיאת ספק בקישור (כבר נוצל אצלו) מפנה להסבר בעברית", async ({
    page,
  }) => {
    // Act - כך נראית ההפניה של Supabase כשהקישור נצרך לפני המשתמש
    await page.goto(
      "/auth/confirm?error=access_denied&error_code=otp_expired" +
        "&error_description=Email+link+is+invalid+or+has+expired",
    );

    // Assert
    await expectExpiredPage(page);
  });

  test("קישור בלי אסימון מפנה להסבר ולא לשגיאה גולמית", async ({ page }) => {
    // Act
    await page.goto("/auth/confirm");

    // Assert
    await expect(page).toHaveURL(/\/auth\/error/);
    await expect(page.getByText("הקישור חסר פרטים")).toBeVisible();
  });
});
