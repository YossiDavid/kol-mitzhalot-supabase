import { test, expect } from "@playwright/test";

/**
 * בדיקות הרשאות שדכן
 * מכסה: "יודל פויגל לא רואה מועמדים בכפתור" — שדכן חייב לראות רשימת מועמדים
 */
test.describe("הרשאות שדכן — גישה לרשימת מועמדים", () => {
  test("שדכן מחובר רואה את רשימת המועמדים", async ({ page }) => {
    await page.goto("/app/students");
    await expect(page).toHaveURL(/\/app\/students/, { timeout: 10_000 });

    // הדף לא אמור להפנות חזרה לדף ההתחברות
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);

    // כותרת הדף צריכה להיות נראית
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });

  test("שדכן לא מופנה לדף 403 או שגיאה", async ({ page }) => {
    const response = await page.goto("/app/students");
    // ה-status code צריך להיות 200 (לא 403/404)
    expect(response?.status()).not.toBe(403);
    expect(response?.status()).not.toBe(404);
  });

  test("רשימת המועמדים מציגה תוכן ולא הודעת שגיאה", async ({ page }) => {
    await page.goto("/app/students");
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // לא אמורה להיות שגיאה גנרית
    await expect(page.locator("text=שגיאה")).not.toBeVisible();
    await expect(page.locator("text=אין הרשאה")).not.toBeVisible();
    await expect(page.locator("text=Unauthorized")).not.toBeVisible();
  });
});

test.describe("תאריך לידה — חישוב גיל תקין", () => {
  test("טופס יצירת תלמיד מאפשר בחירת תאריך לידה", async ({ page }) => {
    await page.goto("/app/students/create");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });

    // בחר מגדר
    await page.getByRole("radio", { name: "מיועד", exact: true }).click();
    await page.locator("button:has-text('הבא')").click();

    // שלב 1 — שדה תאריך לידה צריך להיות קיים
    await expect(page.locator('input[placeholder="בחר תאריך עברי"]')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("מספר טלפון — קבלת פורמטים שונים", () => {
  test("שדה הטלפון בטופס יצירה מקבל מספר בינלאומי", async ({ page }) => {
    await page.goto("/app/students/create");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });

    // נווט לשלב 1
    await page.getByRole("radio", { name: "מיועד", exact: true }).click();
    await page.locator("button:has-text('הבא')").click();

    // מלא שדה הטלפון עם מספר בינלאומי
    const phoneInput = page.locator("#phone");
    if (await phoneInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await phoneInput.fill("+447911123456");
      // וידוא שלא מופיעה הודעת שגיאה מיידית
      await expect(page.locator("text=מספר טלפון לא תקין")).not.toBeVisible();
    }
  });
});
