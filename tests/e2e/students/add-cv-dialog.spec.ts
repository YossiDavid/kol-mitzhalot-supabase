import { test, expect } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * "הוספת קו״ח" בטבלת המיועדים פותח דיאלוג העלאה (ולא מנווט לדף הבית).
 * משתמש הבדיקה הוא שדכן, והכרטיס שייך למשתמש אחר - ההרשאה היא כמו בעריכת
 * כרטיס, ולכן שדכן רשאי להוסיף קו״ח גם לכרטיס שלא הזין.
 */
const STUDENTS_BUCKET = "students";
const FIRST_NAME = "קוח";
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
);

const admin = createServiceClient();
const lastName = `דיאלוג${Date.now()}`;
const studentLabel = `${FIRST_NAME} ${lastName}`;
let studentId: string;

test.beforeAll(async () => {
  const ownerId = await ensureCardManagerId(admin);
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: ownerId,
      first_name: FIRST_NAME,
      last_name: lastName,
      birth_date: "1999-05-01",
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
  const { data: files } = await admin.storage
    .from(STUDENTS_BUCKET)
    .list(studentId);
  if (files?.length) {
    await admin.storage
      .from(STUDENTS_BUCKET)
      .remove(files.map((file) => `${studentId}/${file.name}`));
  }
  await admin.from("students").delete().eq("id", studentId);
});

test("הוספת קו״ח פותחת דיאלוג, מעלה קובץ ומעדכנת את השורה", async ({
  page,
}) => {
  // Arrange
  await page.goto("/app/students");
  await page.locator("#search").fill(lastName);
  const row = page
    .getByRole("table", { name: "רשימת המיועדים" })
    .getByRole("row", { name: `כרטיס מלא: ${studentLabel}` });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Act
  await row.getByRole("button", { name: "הוספת קו״ח" }).click();

  // Assert - דיאלוג, ולא ניווט
  const dialog = page.getByRole("dialog", { name: "הוספת קו״ח" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/app\/students(\?.*)?$/);
  await expect(dialog.getByText(studentLabel)).toBeVisible();
  const saveButton = dialog.getByRole("button", { name: "שמירת הקובץ" });
  await expect(saveButton).toBeDisabled();

  // Act
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "cv.pdf",
    mimeType: "application/pdf",
    buffer: PDF_BYTES,
  });
  await saveButton.click();

  // Assert
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(row.getByRole("link", { name: "קובץ קו״ח" })).toBeVisible();
  await expect(row.getByRole("button", { name: "הוספת קו״ח" })).toHaveCount(0);
  const { data } = await admin
    .from("students")
    .select("cv_url")
    .eq("id", studentId)
    .single();
  expect(data?.cv_url).toContain(`/students/${studentId}/`);
});

test("השרת דוחה קובץ שאינו PDF או תמונה", async ({ page }) => {
  // Act
  const response = await page.request.post(`/api/v1/students/${studentId}/cv`, {
    multipart: {
      file: {
        name: "cv.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not a cv"),
      },
    },
  });

  // Assert
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain("PDF");
});
