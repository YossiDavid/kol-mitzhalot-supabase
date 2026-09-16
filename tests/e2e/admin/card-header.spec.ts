import { test, expect } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * "מחיקת כרטיס" עברה לתפריט הפעולות, אחרי מפריד ובסימון הרסני. היא למנהל
 * בלבד - הצד השני של הבדיקה (שדכן אינו רואה אותה) יושב ב-
 * tests/e2e/students/card-header.spec.ts, שרץ עם משתמש שדכן.
 */
const ACTIONS_BAR = '[data-slot="student-card-actions"]';
const MAX_HEADER_CONTROLS = 3;

test.describe("הדר כרטיס המיועד — מנהל", () => {
  const admin = createServiceClient();
  const lastName = `הדרמנהל${Date.now()}`;
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
    await admin.from("students").delete().eq("id", studentId);
  });

  test("המחיקה זמינה למנהל מתוך התפריט, וההדר נשאר מצומצם", async ({
    page,
  }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);
    await expect(page.locator("h1")).toContainText(lastName);

    // Act
    const controls = page.locator(`${ACTIONS_BAR} button, ${ACTIONS_BAR} a`);
    await page.getByRole("button", { name: "עוד פעולות" }).click();

    // Assert
    expect(await controls.count()).toBeLessThanOrEqual(MAX_HEADER_CONTROLS);
    await expect(
      page.getByRole("menuitem", { name: "מחיקת כרטיס" }),
    ).toBeVisible();
  });

  test("דיאלוג המחיקה נפתח מתוך התפריט", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);
    await expect(page.locator("h1")).toContainText(lastName);

    // Act
    await page.getByRole("button", { name: "עוד פעולות" }).click();
    await page.getByRole("menuitem", { name: "מחיקת כרטיס" }).click();

    // Assert
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "מחק כרטיס" })).toBeVisible();
  });
});
