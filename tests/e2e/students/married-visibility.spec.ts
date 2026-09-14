import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * כרטיס שסומן "נשוי" יוצא משידוכים (in_shidduchim=false) ונעלם מהרשימה
 * הרגילה. בלי דרך להגיע אליו, סימון שגוי לא היה ניתן לתיקון — ולכן סינון
 * מפורש לפי הסטטוס חייב להציג אותו.
 */
test.describe("כרטיס נשוי — נשאר נגיש דרך הסינון", () => {
  const admin = createServiceClient();
  const lastName = `נשוי${Date.now()}`;
  let studentId: string;

  test.beforeAll(async () => {
    const userId = await getTestUserId(admin);
    const { data, error } = await admin
      .from("students")
      .insert({
        user_id: userId,
        first_name: "בדיקה",
        last_name: lastName,
        birth_date: "1998-01-01",
        gender: "male",
        personal_status: "married",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: false,
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

  test("מוסתר ברשימה הרגילה ומוצג בסינון נשוי/ה", async ({ page }) => {
    // Arrange
    await page.goto("/app/students");
    const row = page.getByText(lastName).filter({ visible: true });

    // Act
    await page.locator("#search").fill(lastName);

    // Assert
    await expect(
      page.getByText("לא מצאנו שמות שמתאימים לחיפוש שלך"),
    ).toBeVisible({ timeout: 10_000 });
    await expect(row).toHaveCount(0);

    await page.locator("#personal_status").selectOption("married");
    await expect(row.first()).toBeVisible({ timeout: 10_000 });
  });
});
