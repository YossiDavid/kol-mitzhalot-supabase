import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";
import { approvedCard } from "../helpers/approved-card";

/**
 * כרטיס שסומן "נשוי" יוצא משידוכים (in_shidduchim=false) ונעלם מהרשימה
 * הרגילה. לבקשת ההנהלה "נשוי/ה" הוסר מסינון הסטטוס (המערכת אינה לנשואים);
 * סימון שגוי מתוקן מדף המשתמש בניהול (טבלת הכרטיסים שלו).
 */
test.describe("כרטיס נשוי — מוסתר, ואין סינון נשוי/ה", () => {
  const admin = createServiceClient();
  const lastName = `נשוי${Date.now()}`;
  let studentId: string;

  test.beforeAll(async () => {
    const userId = await getTestUserId(admin);
    const { data, error } = await admin
      .from("students")
      .insert(
        approvedCard({
          user_id: userId,
          first_name: "בדיקה",
          last_name: lastName,
          birth_date: "1998-01-01",
          gender: "male",
          personal_status: "married",
          country: "ישראל",
          city: "בני ברק",
          in_shidduchim: false,
        }),
      )
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

  test("מוסתר ברשימה הרגילה, ו'נשוי/ה' אינו בסינון הסטטוס", async ({
    page,
  }) => {
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

    await expect(
      page.locator("#personal_status option[value='married']"),
    ).toHaveCount(0);
    await expect(
      page.locator("#personal_status option[value='engaged']"),
    ).toHaveCount(1);
  });
});
