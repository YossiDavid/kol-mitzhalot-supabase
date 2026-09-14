import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * גלריית התמונות בעמוד המיועד: בן - גלריה ו-lightbox לכל צופה. בת - נעולה
 * לשדכן בלי אישור צפייה ולצופה לא מחובר, ובלי שום קישור חתום ב-HTML.
 */
const admin = createServiceClient();
const BUCKET = "students";
const SIGNED_URL_MARKER = "/object/sign/students/";
/** PNG תקין בגודל 1x1 */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const MALE_PHOTOS = 3;
const FEMALE_PHOTOS = 2;
/** בעל הכרטיסים אינו משתמש הבדיקה - בעל כרטיס רשאי לראות גם תמונות בת */
const CARD_OWNER_EMAIL = "playwright-card-manager@kol-mitzhalot.test";

let maleId: string;
let femaleId: string;
const uploadedPaths: string[] = [];

async function createStudentWithPhotos(
  userId: string,
  gender: "male" | "female",
  photoCount: number,
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: gender === "male" ? "גלריה" : "גלריית",
      last_name: `בדיקה${Date.now()}`,
      birth_date: "1998-01-01",
      gender,
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת מיועד נכשלה: ${error?.message}`);
  const studentId = data.id as string;

  const rows = [];
  for (let position = 0; position < photoCount; position += 1) {
    const path = `${studentId}/photos/test-${position}.png`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, TINY_PNG, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`העלאה נכשלה: ${uploadError.message}`);
    uploadedPaths.push(path);
    rows.push({ student_id: studentId, storage_path: path, position });
  }
  const { error: rowsError } = await admin.from("student_photos").insert(rows);
  if (rowsError) throw new Error(`שמירת גלריה נכשלה: ${rowsError.message}`);

  return studentId;
}

test.beforeAll(async () => {
  const ownerId = await getTestUserId(admin, CARD_OWNER_EMAIL);
  maleId = await createStudentWithPhotos(ownerId, "male", MALE_PHOTOS);
  femaleId = await createStudentWithPhotos(ownerId, "female", FEMALE_PHOTOS);
});

test.afterAll(async () => {
  await admin.storage.from(BUCKET).remove(uploadedPaths);
  await admin.from("students").delete().in("id", [maleId, femaleId]);
});

test.describe("שדכן מחובר", () => {
  test("בן: גלריה עם lightbox ודפדוף", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${maleId}`);

    // Act
    await page
      .getByRole("button", {
        name: `פתיחת גלריית התמונות (${MALE_PHOTOS} תמונות)`,
      })
      .click();

    // Assert
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`1 / ${MALE_PHOTOS}`)).toBeVisible();
    await dialog.getByRole("button", { name: "התמונה הבאה" }).click();
    await expect(dialog.getByText(`2 / ${MALE_PHOTOS}`)).toBeVisible();
  });

  test("בת בלי אישור צפייה: נעולה ובלי קישור חתום", async ({ page }) => {
    // Act
    const response = await page.goto(`/app/students/${femaleId}`);

    // Assert
    await expect(
      page.getByRole("button", { name: "בקשת הרשאה לצפייה בתמונה" }),
    ).toBeVisible({ timeout: 15_000 });
    expect(await response?.text()).not.toContain(SIGNED_URL_MARKER);
  });
});

test.describe("צופה לא מחובר", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("בן: הגלריה מוצגת", async ({ page }) => {
    await page.goto(`/app/students/${maleId}`);
    await expect(
      page.getByRole("button", {
        name: `פתיחת גלריית התמונות (${MALE_PHOTOS} תמונות)`,
      }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("בת: אין שום קישור חתום ב-HTML", async ({ page }) => {
    const response = await page.goto(`/app/students/${femaleId}`);
    await expect(page.getByText("חסוי")).toBeVisible({ timeout: 15_000 });
    expect(await response?.text()).not.toContain(SIGNED_URL_MARKER);
  });
});
