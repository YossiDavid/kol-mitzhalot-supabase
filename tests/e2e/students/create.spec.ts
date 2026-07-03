import { test, expect, Page } from "@playwright/test";

const fill = (page: Page, fieldName: string, value: string) =>
  page.locator(`#${fieldName.replace(/[^a-zA-Z0-9]+/g, "-")}`).fill(value);

test.describe("יצירת תלמיד חדש", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/app/students/create");
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });

  test("טופס יצירת תלמיד מוצג בצורה תקינה", async ({ page }) => {
    // Step 0 should be visible
    await expect(page.locator("text=ברוכים הבאים")).toBeVisible();
    await expect(page.getByRole("radio", { name: "מיועד", exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: "מיועדת", exact: true })).toBeVisible();
  });

  test("ניווט בין שלבים עובד", async ({ page }) => {
    // Step 0 — select gender
    await page.getByRole("radio", { name: "מיועד", exact: true }).click();
    await page.locator("button:has-text('הבא')").click();

    // Step 1 — basic information should appear
    await expect(page.locator("text=שם פרטי")).toBeVisible();
  });

  test("ולידציה של שלב חוסמת מעבר כשחסרים שדות חובה", async ({ page }) => {
    // On step 0, click Next without selecting gender
    await page.locator("button:has-text('הבא')").click();

    // Should stay on step 0 (gender error visible)
    await expect(page.locator("text=ברוכים הבאים")).toBeVisible();
  });

  test("זרימת יצירה מלאה — 7 שלבים עד Submit", async ({ page }) => {
    // ── Step 0: Gender ─────────────────────────────────────────────
    await page.getByRole("radio", { name: "מיועד", exact: true }).click();
    await page.locator("button:has-text('הבא')").click();

    // ── Step 1: Basic information ───────────────────────────────────
    await expect(page.locator("text=שם פרטי")).toBeVisible();

    await fill(page, "firstName", "ישראל");
    await fill(page, "lastName", "ישראלי");
    await fill(page, "identityNumber", "123456789");
    await fill(page, "country", "ישראל");
    await fill(page, "city", "בני ברק");
    await fill(page, "street", "רב שך");
    await fill(page, "house", "5");

    // Birth date — find the date input (Jewish date picker renders an underlying input)
    const birthInput = page.locator("input[type='date'], input[placeholder*='תאריך'], input[placeholder*='DD']").first();
    if (await birthInput.isVisible()) {
      await birthInput.fill("2000-01-15");
    } else {
      // Fallback: fill the text input associated with birthDate
      await fill(page, "birthDate", "2000-01-15");
    }

    // personalStatus select
    const selects = page.locator("select");
    await selects.nth(0).selectOption("single");  // personalStatus
    await selects.nth(1).selectOption("kosher");   // cellphoneType
    await selects.nth(2).selectOption("koilel");   // planForLife (male only)

    await page.locator("button:has-text('הבא')").click();

    // ── Step 2: Family info ─────────────────────────────────────────
    await expect(page.locator("text=על המשפחה").first()).toBeVisible({ timeout: 5_000 });

    await fill(page, "father.self.name", "אברהם");
    await fill(page, "father.phone", "0501234567");
    await fill(page, "father.job", "מלמד");
    await fill(page, "father.grandFather.name", "יצחק");
    await fill(page, "father.grandMother.name", "שרה");
    await fill(page, "mother.self.name", "רחל");
    await fill(page, "mother.maidenName", "לוי");
    await fill(page, "mother.phone", "0507654321");
    await fill(page, "mother.job", "מורה");
    await fill(page, "mother.grandFather.name", "יעקב");
    await fill(page, "mother.grandMother.name", "לאה");
    await fill(page, "family.numberOfChildren", "5");
    await fill(page, "family.currentChildPlace", "3");
    await fill(page, "family.about", "משפחה חסידית תורנית");

    await page.locator("button:has-text('הבא')").click();

    // ── Step 3: Education ───────────────────────────────────────────
    await expect(page.locator("button:has-text('הבא')")).toBeVisible({ timeout: 5_000 });
    await page.locator("button:has-text('הבא')").click();

    // ── Step 4: Parents status ──────────────────────────────────────
    await expect(page.locator("button:has-text('הבא')")).toBeVisible({ timeout: 5_000 });
    await page.locator("button:has-text('הבא')").click();

    // ── Step 5: Medical ─────────────────────────────────────────────
    await expect(page.locator("button:has-text('הבא')")).toBeVisible({ timeout: 5_000 });
    await page.locator("button:has-text('הבא')").click();

    // ── Step 6: Partner + Author ────────────────────────────────────
    await expect(page.locator("button[type='submit']")).toBeVisible({ timeout: 5_000 });

    await fill(page, "partner.additionalInformation", "מחפשים בן תורה עם מידות טובות");
    await fill(page, "author.name", "יוסף ישראלי");
    await fill(page, "author.phone", "0521234567");

    // Submit
    const submitBtn = page.locator("button[type='submit']");
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // After success → should redirect to the student profile page
    await expect(page).toHaveURL(/\/app\/students\/[a-f0-9-]{36}/, {
      timeout: 20_000,
    });
  });
});
