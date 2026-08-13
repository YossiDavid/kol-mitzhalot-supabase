/**
 * Callers: Playwright `marketing` project.
 * API: public website routes + contact/newsletter forms → DB.
 * User: "9. אתה יכול להוסיף גם טסטים."
 */
import { test, expect } from "@playwright/test";

test.describe("עמודי שיווק ציבוריים", () => {
  test("דף הבית נטען עם מותג", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("קול מצהלות").first()).toBeVisible();
  });

  test("מסלולים ותמיכה אינם stubs", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "מסלולים" })).toBeVisible();
    await expect(page.getByText("PricingPage")).toHaveCount(0);

    await page.goto("/support");
    await expect(
      page.getByRole("heading", { name: "שירות ותמיכה" }),
    ).toBeVisible();
    await expect(page.getByText("SupportPage")).toHaveCount(0);
  });

  test("עמוד משפטי מציג תוכן", async ({ page }) => {
    await page.goto("/legal/privacy-policy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("גרסת טיוטה לדוגמה")).toBeVisible();
  });

  test("טופס צור קשר שולח פנייה", async ({ page }) => {
    await page.goto("/contact");
    const form = page.locator("#contact form");
    await form.getByLabel("שם").fill("בדיקת מערכת");
    await form.getByLabel("מייל").fill("test-contact@example.com");
    await form.getByLabel("נושא").fill("בדיקה אוטומטית");
    await form.getByLabel("הודעה").fill("זו פנייה לבדיקת E2E בלבד.");
    await form.getByRole("button", { name: "שליחה" }).click();
    await expect(page.getByText("הפנייה נשלחה בהצלחה!")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("הרשמה לניוזלטר מהפוטר", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await footer
      .getByLabel("כתובת מייל לרשימת תפוצה")
      .fill(`newsletter-e2e-${Date.now()}@example.com`);
    await footer.getByRole("button", { name: "הרשמה" }).click();
    await expect(footer.getByText("נרשמתם בהצלחה לרשימת התפוצה.")).toBeVisible({
      timeout: 15_000,
    });
  });
});
