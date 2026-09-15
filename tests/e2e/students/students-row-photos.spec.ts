import { test, expect, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * תמונה ממוזערת בשורה של טבלת המיועדים: בן - תמונה ולחיצה פותחת lightbox
 * עם כל הגלריה בלי לפתוח את הכרטיס. בת בלי אישור צפייה - מנעול, ואף קישור
 * חתום לא מגיע לדפדפן (גם לא בתשובות הרשת).
 */
const admin = createServiceClient();
const BUCKET = "students";
const SIGNED_URL_MARKER = "/object/sign/students/";
const THUMBNAILS_ENDPOINT = "/api/v1/students/photos/thumbnails";
const TABLE_CAPTION = "רשימת המיועדים";
const MOBILE_VIEWPORT = { width: 390, height: 844 };
/** PNG תקין בגודל 1x1 */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const MALE_PHOTOS = 3;
const FEMALE_PHOTOS = 2;

const lastName = `שורתתמונה${Date.now()}`;
const maleName = `שמעון ${lastName}`;
const femaleName = `שולמית ${lastName}`;

let maleId: string;
let femaleId: string;
let uploadedPaths: string[] = [];

async function createStudentWithPhotos(
  ownerId: string,
  gender: "male" | "female",
  photoCount: number,
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: ownerId,
      first_name: gender === "male" ? "שמעון" : "שולמית",
      last_name: lastName,
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

  const paths = Array.from(
    { length: photoCount },
    (_, position) => `${studentId}/photos/row-${position}.png`,
  );
  for (const path of paths) {
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, TINY_PNG, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`העלאה נכשלה: ${uploadError.message}`);
    uploadedPaths = [...uploadedPaths, path];
  }
  const { error: rowsError } = await admin.from("student_photos").insert(
    paths.map((storage_path, position) => ({
      student_id: studentId,
      storage_path,
      position,
    })),
  );
  if (rowsError) throw new Error(`שמירת גלריה נכשלה: ${rowsError.message}`);

  return studentId;
}

test.beforeAll(async () => {
  // בעל הכרטיסים אינו משתמש הבדיקה - בעלים רשאי לראות גם תמונות בת
  const ownerId = await ensureCardManagerId(admin);
  maleId = await createStudentWithPhotos(ownerId, "male", MALE_PHOTOS);
  femaleId = await createStudentWithPhotos(ownerId, "female", FEMALE_PHOTOS);
});

test.afterAll(async () => {
  if (uploadedPaths.length > 0) {
    await admin.storage.from(BUCKET).remove(uploadedPaths);
  }
  // student_photos נמחקות ב-cascade
  await admin
    .from("students")
    .delete()
    .in("id", [maleId, femaleId].filter(Boolean));
});

/** מספר הכרטיסים שהבדיקה יוצרת (בן ובת) - אחרי הסינון רק הם נשארים */
const TEST_STUDENTS_COUNT = 2;

async function searchForTestStudents(page: Page, isMobile = false) {
  await page.goto("/app/students");
  if (isMobile) {
    await page.getByRole("button", { name: "חיפוש וסינון" }).click();
    await page.locator("#m-search").fill(lastName);
  } else {
    await page.locator("#search").fill(lastName);
  }
  // החיפוש מתעדכן אחרי debounce וטוען את הרשימה מחדש. הכרטיסים החדשים מופיעים
  // כבר ברשימה המלאה, ולחיצה לפני הסינון נבלעת: הרשימה מתחלפת בשלד הטעינה
  // והגלריה שנפתחה נסגרת. ממתינים עד שנשארים רק כרטיסי הבדיקה.
  const results = isMobile
    ? page
        .getByRole("list", { name: TABLE_CAPTION })
        .getByRole("group", { name: /^כרטיס מלא:/ })
    : page
        .getByRole("table", { name: TABLE_CAPTION })
        .getByRole("row", { name: /^כרטיס מלא:/ });
  await expect(results).toHaveCount(TEST_STUDENTS_COUNT, { timeout: 15_000 });
}

test.describe("תמונה בשורת הטבלה - דסקטופ", () => {
  test("בן: התמונה מוצגת בשורה ולחיצה פותחת את כל הגלריה בלי לפתוח את הכרטיס", async ({
    page,
  }) => {
    // Arrange
    await searchForTestStudents(page);
    const row = page
      .getByRole("table", { name: TABLE_CAPTION })
      .getByRole("row", { name: `כרטיס מלא: ${maleName}` });
    const thumbnail = row.getByRole("button", {
      name: `הצגת תמונות: ${maleName}`,
    });
    await expect(thumbnail).toBeVisible({ timeout: 15_000 });
    await expect(thumbnail.locator("img")).toHaveAttribute(
      "src",
      new RegExp(SIGNED_URL_MARKER),
    );

    // Act
    await thumbnail.click();

    // Assert
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`1 / ${MALE_PHOTOS}`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(dialog.locator("img")).toHaveCount(MALE_PHOTOS);
    await dialog.getByRole("button", { name: "התמונה הבאה" }).click();
    await expect(dialog.getByText(`2 / ${MALE_PHOTOS}`)).toBeVisible();
    await dialog.getByRole("button", { name: "סגירה" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/app\/students(\?.*)?$/);
  });

  test("בת בלי אישור צפייה: מנעול, ואף קישור חתום לא נשלח אליה", async ({
    page,
  }) => {
    // Arrange - כל תשובות התמונות הממוזערות שהטבלה קיבלה
    const thumbnailBodies: Promise<string>[] = [];
    page.on("response", (response) => {
      if (response.url().includes(THUMBNAILS_ENDPOINT)) {
        thumbnailBodies.push(response.text());
      }
    });

    // Act
    await searchForTestStudents(page);
    const row = page
      .getByRole("table", { name: TABLE_CAPTION })
      .getByRole("row", { name: `כרטיס מלא: ${femaleName}` });

    // Assert - ממשק
    await expect(
      row.getByRole("button", {
        name: `בקשת הרשאה לצפייה בתמונה: ${femaleName}`,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(row.locator("img")).toHaveCount(0);

    // Assert - מה שהטבלה קיבלה ברשת
    const bodies = await Promise.all(thumbnailBodies);
    const femaleEntries = bodies
      .map((body) => JSON.parse(body).thumbnails?.[femaleId])
      .filter(Boolean);
    expect(femaleEntries.length).toBeGreaterThan(0);
    for (const entry of femaleEntries) {
      expect(entry).toEqual({ status: "locked" });
    }

    // Assert - נקודות הקצה עצמן
    const thumbnails = await page.request.post(THUMBNAILS_ENDPOINT, {
      data: { studentIds: [femaleId, maleId] },
    });
    expect(thumbnails.status()).toBe(200);
    const { thumbnails: byId } = await thumbnails.json();
    expect(byId[femaleId]).toEqual({ status: "locked" });
    expect(byId[maleId]).toMatchObject({ status: "ok" });
    expect(JSON.stringify(byId[femaleId])).not.toContain(SIGNED_URL_MARKER);

    const gallery = await page.request.get(
      `/api/v1/students/${femaleId}/photos`,
    );
    expect(gallery.status()).toBe(403);
    expect(await gallery.text()).not.toContain(SIGNED_URL_MARKER);
  });
});

test.describe("תמונה בשורת הטבלה - מובייל", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("התמונה מוצגת בכותרת הכרטיס ופותחת את הגלריה", async ({ page }) => {
    // Arrange
    await searchForTestStudents(page, true);
    const card = page
      .getByRole("list", { name: TABLE_CAPTION })
      .getByRole("group", { name: `כרטיס מלא: ${maleName}` });
    const thumbnail = card.getByRole("button", {
      name: `הצגת תמונות: ${maleName}`,
    });
    await expect(thumbnail).toBeVisible({ timeout: 15_000 });

    // Act
    await thumbnail.click();

    // Assert
    await expect(
      page.getByRole("dialog").getByText(`1 / ${MALE_PHOTOS}`),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/app\/students(\?.*)?$/);
  });
});

test.describe("צופה לא מחובר", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("נקודות הקצה של התמונות דורשות התחברות", async ({ request }) => {
    const thumbnails = await request.post(THUMBNAILS_ENDPOINT, {
      data: { studentIds: [maleId] },
    });
    expect(thumbnails.status()).toBe(401);

    const gallery = await request.get(`/api/v1/students/${maleId}/photos`);
    expect(gallery.status()).toBe(401);
  });
});
