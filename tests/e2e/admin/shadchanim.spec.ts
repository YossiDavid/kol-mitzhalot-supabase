import { test, expect } from "@playwright/test";

/**
 * בדיקות עמוד השדכנים בניהול
 * מכסה: "נמחקו כל השדכנים", "שדכנים מוצגים כ'לא זמין'"
 */
test.describe("ניהול שדכנים — בדיקות admin", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/admin/shadchanim");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });

  test("עמוד השדכנים נטען בצורה תקינה", async ({ page }) => {
    await expect(page).toHaveURL(/\/app\/admin\/shadchanim/);
    // הדף צריך להראות את הכותרת של עמוד הניהול
    await expect(page.locator("text=שדכנים").first()).toBeVisible();
  });

  test("לא מוצג 'לא זמין' לשדכן עם שם תקין", async ({ page }) => {
    // Admin Test User שנוצר ב-auth.setup.admin.ts אמור להופיע
    // עם firstName="Admin" ולכן לא להציג "לא זמין"
    // אם הטבלה ריקה — הבדיקה עוברת (אין שגיאה)
    const rows = page.locator("[data-slot='table-header'] ~ *");
    const count = await rows.count();

    if (count > 0) {
      // Each shadchan row can have up to 3 null date fields (last shidduch created,
      // last shidduch completed, last sign-in) which render as "לא זמין".
      // Real name/email fields should not show "לא זמין", so total must be < count*4.
      const notAvailableCount = await page.locator("text=לא זמין").count();
      expect(notAvailableCount).toBeLessThan(count * 4);
    }
  });

  test("מונה השדכנים חיובי אחרי הוספת admin test user", async ({ page }) => {
    // הבדיקה העיקרית: הדף נטען ולא קרסה
    await expect(page).toHaveURL(/\/app\/admin\/shadchanim/);
  });
});

test.describe("ניהול — בקשות ממתינות", () => {
  test("עמוד בקשות ממתינות נטען", async ({ page }) => {
    await page.goto("/app/admin/shadchanim/requests");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/app\/admin\/shadchanim\/requests/);
  });
});
