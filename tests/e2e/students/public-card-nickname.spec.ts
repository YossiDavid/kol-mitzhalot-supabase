import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * הכינוי מוצג גם בתצוגה הציבורית (קישור שיתוף), כמו בטבלה ובכרטיס המלא.
 * השדה נכלל ב-ANONYMOUS_STUDENT_SELECT במפורש: עמודה שאינה נשלפת מגיעה
 * undefined ונעלמת בשקט, בלי שגיאה - ולכן הבדיקה מאמתת את השליפה ולא רק
 * את הרינדור.
 */
const NICKNAME = "יוסי";
const RUN_ID = Date.now();
const LAST_NAME = `ציבורי${RUN_ID}`;

const admin = createServiceClient();
let studentId: string;

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: "יוסף",
      last_name: LAST_NAME,
      nickname: NICKNAME,
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

test.describe("צופה לא מחובר (קישור שיתוף)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("הכינוי מוצג בסוגריים גם בכרטיס הציבורי", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);

    // Assert
    await expect(page.locator("h1")).toHaveText(
      `יוסף (${NICKNAME}) ${LAST_NAME}`,
    );

    // Assert - רשימת ההיתר לא נפרצה: שדות רגישים עדיין אינם נשלפים
    await expect(page.getByText("תעודת זהות")).toHaveCount(0);
    await expect(page.getByText("טלפון")).toHaveCount(0);
  });
});
