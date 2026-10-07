import { expect, test } from "@playwright/test";

/**
 * דף השגיאה לא מציג לעולם טקסט גולמי של הספק: כל הודעה ידועה מתורגמת
 * להסבר בעברית עם הצעד הבא, וכל הודעה אחרת נשארת כללית.
 */

const CASES = [
  {
    name: "קישור שפג תוקפו",
    query:
      "code=otp_expired&error=Email%20link%20is%20invalid%20or%20has%20expired",
    expected: /הקישור כבר נוצל, פג תוקפו/,
    offersCode: true,
  },
  {
    name: "access_denied בלי קוד",
    query: "error=access_denied",
    expected: /הכניסה לא אושרה/,
    offersCode: true,
  },
  {
    name: "PKCE - דפדפן אחר",
    query:
      "error=both%20auth%20code%20and%20code%20verifier%20should%20be%20non-empty",
    expected: /נפתח בדפדפן או במכשיר שונים/,
    offersCode: true,
  },
  {
    name: "הגבלת קצב",
    query:
      "error=For%20security%20purposes%2C%20you%20can%20only%20request%20this%20after%2042%20seconds.",
    expected: /רק אחרי 42 שניות/,
    offersCode: true,
  },
  {
    name: "הרשמה לא מאופשרת",
    query: "error=Signups%20not%20allowed%20for%20otp",
    expected: /לא נמצא חשבון עם כתובת המייל הזו/,
    offersCode: false,
  },
  {
    name: "שגיאה לא מוכרת",
    query: "error=Some%20brand%20new%20provider%20failure",
    expected: /לא הצלחנו להשלים את הכניסה/,
    offersCode: true,
  },
];

test.describe("דף שגיאת ההתחברות", () => {
  for (const { name, query, expected, offersCode } of CASES) {
    test(`${name}: הסבר בעברית בלי טקסט הספק`, async ({ page }) => {
      // Act
      await page.goto(`/auth/error?${query}`);

      // Assert
      await expect(page.getByText(expected)).toBeVisible();
      await expect(page.locator("main")).not.toContainText(
        /invalid|expired|verifier|Signups|security purposes|provider/i,
      );
      await expect(page.getByText("הזנת קוד מהמייל")).toHaveCount(
        offersCode ? 1 : 0,
      );
    });
  }

  test("טקסט שגיאה עם HTML לא מוצג ולא מורץ", async ({ page }) => {
    // Act
    await page.goto(
      `/auth/error?error=${encodeURIComponent('<img src=x onerror="window.__xss=1">'.repeat(40))}`,
    );

    // Assert
    await expect(page.getByText(/לא הצלחנו להשלים את הכניסה/)).toBeVisible();
    await expect(page.locator("main img[src='x']")).toHaveCount(0);
    expect(await page.evaluate(() => "__xss" in window)).toBe(false);
  });

  test("הצעת קישור חדש שומרת את היעד המסונן", async ({ page }) => {
    // Act
    await page.goto("/auth/error?code=otp_expired&next=%2Fapp%2Fsettings");

    // Assert
    await expect(
      page.getByRole("link", { name: "בקשת קישור חדש" }),
    ).toHaveAttribute("href", "/auth/login?next=%2Fapp%2Fsettings");
  });

  test("יעד חיצוני ב-next נזרק", async ({ page }) => {
    // Act
    await page.goto(
      "/auth/error?code=otp_expired&next=https%3A%2F%2Fevil.example",
    );

    // Assert
    await expect(
      page.getByRole("link", { name: "בקשת קישור חדש" }),
    ).toHaveAttribute("href", "/auth/login");
  });
});
