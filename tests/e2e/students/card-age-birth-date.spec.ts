import { test, expect } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * לחיצה על הגיל בכרטיס חושפת את תאריך הלידה בלוח העברי בלבד. הגיל מופיע
 * פעמיים (שורת המטא בהדר ו"גיל" ב"פרטים אישיים") ובשניהם זה כפתור אמיתי.
 * 1.1.1998 נופל בטבת.
 */
const HEBREW_MONTH = /טבת/;
const AGE_BUTTON = '[data-slot="age-birth-date"]';

const admin = createServiceClient();
const lastName = `גיל${Date.now()}`;
let studentId: string;

test.beforeAll(async () => {
  const ownerId = await ensureCardManagerId(admin);
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: ownerId,
      first_name: "בדיקת",
      last_name: lastName,
      birth_date: "1998-01-01",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
  }
  studentId = data.id as string;
});

test.afterAll(async () => {
  if (studentId) await admin.from("students").delete().eq("id", studentId);
});

test.describe("תאריך לידה עברי בלחיצה על הגיל", () => {
  test("לחיצה על הגיל בהדר מציגה תאריך עברי בלבד", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);
    await expect(page.locator("h1")).toContainText(lastName);
    const meta = page.locator('[data-slot="student-card-meta"]');

    // Act
    await meta.locator(AGE_BUTTON).click();

    // Assert
    const value = page.locator('[data-slot="age-birth-date-value"]');
    await expect(value).toHaveText(HEBREW_MONTH);
    await expect(value).not.toHaveText(/1998|01\/01|1\.1/);
  });

  test("הגיל ב\"פרטים אישיים\" פועל במקלדת", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);
    await expect(page.locator("h1")).toContainText(lastName);
    const button = page.getByRole("button", { name: /שנים.*תאריך לידה עברי/ });

    // Act
    await button.focus();
    await page.keyboard.press("Enter");

    // Assert
    await expect(
      page.locator('[data-slot="age-birth-date-value"]'),
    ).toHaveText(HEBREW_MONTH);
  });
});

test.describe("צופה לא מחובר", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("הגיל אינו לחיץ ותאריך הלידה לא מגיע לדף", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);
    await expect(page.locator("h1")).toContainText(lastName);

    // Assert
    await expect(page.locator(AGE_BUTTON)).toHaveCount(0);
    await expect(page.getByText(/גיל \d+/)).toBeVisible();
    expect(await page.content()).not.toContain("1998-01-01");
  });
});
