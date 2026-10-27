import { test, expect } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import { insertCompleteCard } from "../helpers/complete-card";

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
    studentId = await insertCompleteCard(admin, {
      userId: await getTestUserId(admin),
      firstName: "קו״ח",
      lastName: `שמור${Date.now()}`,
      extra: { cv_url: STORED_CV_URL },
    });
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

  test("הסרת הקובץ השמור ושמירה מוחקת את הקו״ח מהכרטיס", async ({ page }) => {
    // Arrange
    await admin
      .from("students")
      .update({ cv_url: STORED_CV_URL })
      .eq("id", studentId);
    await page.goto(`/app/students/${studentId}/edit`);
    await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button", { name: "פרטים אישיים", exact: true })
      .click();
    const cvCell = page.locator('[data-field-name="cv"]');

    // Act
    await cvCell.getByRole("button", { name: "הסרת הקובץ" }).click();
    await expect(cvCell.getByText("קובץ קו״ח קיים")).toHaveCount(0);
    await page
      .getByRole("button", { name: "שמירת שינויים", exact: true })
      .click();

    // Assert
    await expect(page.getByText("השינויים נשמרו בהצלחה!")).toBeVisible({
      timeout: 20_000,
    });
    const { data } = await admin
      .from("students")
      .select("cv_url")
      .eq("id", studentId)
      .single();
    expect(data?.cv_url).toBeNull();
  });

  test("שדכן שאינו בעל הכרטיס מעלה קו״ח חדש בעריכה, והוא נשמר", async ({
    page,
  }) => {
    // Arrange - כרטיס של מנהל כרטיסים אחר; משתמש הבדיקה הוא שדכן
    const managerId = await ensureCardManagerId(admin);
    const otherCardId = await insertCompleteCard(admin, {
      userId: managerId,
      firstName: "קו״ח",
      lastName: `שדכן${Date.now()}`,
      extra: { cv_url: STORED_CV_URL },
    });

    try {
      await page.goto(`/app/students/${otherCardId}/edit`);
      await page
        .getByRole("navigation", { name: "שלבי הטופס" })
        .getByRole("button", { name: "פרטים אישיים", exact: true })
        .click();
      const cvCell = page.locator('[data-field-name="cv"]');

      // Act
      await cvCell.locator('input[type="file"]').setInputFiles({
        name: "new-cv.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n%%EOF"),
      });
      await page
        .getByRole("button", { name: "שמירת שינויים", exact: true })
        .click();

      // Assert
      await expect(page.getByText("השינויים נשמרו בהצלחה!")).toBeVisible({
        timeout: 20_000,
      });
      const { data } = await admin
        .from("students")
        .select("cv_url")
        .eq("id", otherCardId)
        .single();
      expect(data?.cv_url).toContain(`/students/${otherCardId}/`);
      expect(data?.cv_url).toMatch(/\/\d+-cv\.pdf/);
    } finally {
      await admin.storage
        .from("students")
        .list(otherCardId)
        .then(({ data }) =>
          data?.length
            ? admin.storage
                .from("students")
                .remove(data.map((file) => `${otherCardId}/${file.name}`))
            : null,
        );
      await admin.from("students").delete().eq("id", otherCardId);
    }
  });
});
