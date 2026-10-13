import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";
import { approvedCard } from "../helpers/approved-card";

/**
 * הממליצים מוצגים בכרטיס הציבורי (קישור שיתוף) בסוג ובשם בלבד. הלקוח ביקש
 * בעבר להציג גם טלפון ואימייל, וחזר בו: הכרטיס הציבורי אינו מציג פרטי קשר של
 * אף אדם. ה-embed ב-ANONYMOUS_STUDENT_SELECT אינו שולף אותם, ובדיקה זו מאמתת
 * שהם אינם מגיעים לדף - לא כקישור ולא בתוך ה-HTML.
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
    .insert(
      approvedCard({
        user_id: userId,
        first_name: "בדיקת",
        last_name: `ציבורי${Date.now()}`,
        birth_date: "1998-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
      }),
    )
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

  test("הממליצים מוצגים בשם בלבד, בלי טלפון ואימייל", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}`);

    // Assert
    await expect(page.getByText("ממליצים", { exact: true })).toBeVisible();
    await expect(page.getByText(REF_NAME)).toBeVisible();
    await expect(page.getByRole("link", { name: REF_PHONE })).toHaveCount(0);
    await expect(page.getByRole("link", { name: REF_EMAIL })).toHaveCount(0);
    const html = await (await page.request.get(page.url())).text();
    expect(html).not.toContain(REF_PHONE);
    expect(html).not.toContain(REF_EMAIL);
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
