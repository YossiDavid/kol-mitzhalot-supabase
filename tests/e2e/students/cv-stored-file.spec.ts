import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * בעריכת כרטיס עם קו״ח שמור, אזור הקו״ח מראה שהקובץ קיים, עם קישור לפתיחה
 * (הקישור החתום שב-cv_url) ודרך ברורה להחליף אותו.
 */

const STORED_CV_URL =
  "https://example.test/storage/v1/object/sign/students/playwright/1712345678901-cv.pdf?token=abc";

test.describe("קו״ח שמור בעריכת כרטיס", () => {
  const admin = createServiceClient();
  let studentId: string;

  test.beforeAll(async () => {
    const userId = await getTestUserId(admin);
    const { data, error } = await admin
      .from("students")
      .insert({
        user_id: userId,
        first_name: "קו״ח",
        last_name: `שמור${Date.now()}`,
        identity_number: `8${String(Date.now()).slice(-8)}`,
        birth_date: "1998-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        cellphone_type: "kosher",
        in_shidduchim: true,
        cv_url: STORED_CV_URL,
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

  test("מוצג הקובץ השמור עם קישור לפתיחה ואפשרות החלפה", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}/edit`);
    await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button", { name: "פרטים אישיים", exact: true })
      .click();
    const cvCell = page.locator('[data-field-name="cv"]');

    // Assert
    await expect(cvCell.getByText("קובץ קו״ח קיים")).toBeVisible();
    await expect(cvCell.getByText("cv.pdf", { exact: true })).toBeVisible();
    const openLink = cvCell.getByRole("link", { name: "פתיחת הקובץ" });
    await expect(openLink).toHaveAttribute("href", STORED_CV_URL);
    await expect(openLink).toHaveAttribute("target", "_blank");
    await expect(cvCell.getByText("החלפת הקובץ")).toBeVisible();

    // Act: קובץ חדש נבחר
    await cvCell.locator('input[type="file"]').setInputFiles({
      name: "new-cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });

    // Assert
    await expect(
      cvCell.getByText("הקובץ החדש שבחרתם יחליף אותו בשמירה."),
    ).toBeVisible();
    await expect(openLink).toBeVisible();
  });
});
