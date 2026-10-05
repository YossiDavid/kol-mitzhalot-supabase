import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * הממליצים מוצגים במלואם גם בכרטיס הציבורי (קישור שיתוף) - החלטת הלקוח:
 * סוג, שם, טלפון ואימייל. העמודה נכללת ב-ANONYMOUS_STUDENT_SELECT, ובדיקה
 * זו מאמתת את השליפה (עמודה שלא נשלפה פשוט נעלמת בלי שגיאה).
 */
const REF_NAME = `ממליץ${Date.now()}`;
const REF_PHONE = "0501234567";
const REF_EMAIL = "ref-public@example.com";

const admin = createServiceClient();
let studentId: string;

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: "בדיקת",
      last_name: `ציבורי${Date.now()}`,
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

  const { error: refError } = await admin.from("references").insert({
    student_id: studentId,
    reference_type: "rabbi",
    name: REF_NAME,
    phone: REF_PHONE,
    email: REF_EMAIL,
  });
  if (refError) {
    throw new Error(`יצירת הממליץ נכשלה: ${refError.message}`);
  }
});

test.afterAll(async () => {
  // references נמחקת ב-cascade
  if (studentId) await admin.from("students").delete().eq("id", studentId);
});

test.describe("צופה לא מחובר (קישור שיתוף)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("הממליצים מוצגים עם שם, טלפון ואימייל", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);

    // Assert
    await expect(page.getByText("ממליצים", { exact: true })).toBeVisible();
    await expect(page.getByText(REF_NAME)).toBeVisible();
    await expect(page.getByRole("link", { name: REF_PHONE })).toHaveAttribute(
      "href",
      `tel:${REF_PHONE}`,
    );
    await expect(page.getByRole("link", { name: REF_EMAIL })).toHaveAttribute(
      "href",
      `mailto:${REF_EMAIL}`,
    );
  });

  test("שאר השדות הרגישים עדיין אינם נשלפים", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);
    await expect(page.getByText(REF_NAME)).toBeVisible();

    // Assert
    await expect(page.getByText("תעודת זהות")).toHaveCount(0);
    await expect(page.getByText("אימייל מנהל הכרטיס")).toHaveCount(0);
    expect(await page.content()).not.toContain("1998-01-01");
  });
});
