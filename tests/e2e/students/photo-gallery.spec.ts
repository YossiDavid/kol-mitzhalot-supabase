import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * גלריית התמונות בעריכת כרטיס: תמונה חדשה נוספת לצד השמורה, מוגדרת
 * כראשית, ואחרי השמירה student_photos משקפת את הסדר ו-photo_count מתעדכן.
 */

const BUCKET = "students";
// PNG תקין בגודל 1x1
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const NAME = { prefix: "", name: "בדיקה", suffix: "" };

/** נתיב קו״ח שכבר שמור בכרטיס. הקובץ עצמו לא נדרש לבדיקה */
const EXISTING_CV_URL = "playwright/cv/existing.pdf";

/** זהה ל-MAX_STUDENT_PHOTO_BYTES */
const MAX_STORED_BYTES = 1024 * 1024;
/** PNG של רעש בגודל הזה שוקל כמה MB */
const LARGE_PHOTO_SIZE_PX = 1800;

test.describe("גלריית תמונות בעריכת כרטיס", () => {
  const admin = createServiceClient();
  let studentId: string;
  let seedPath: string;

  test.beforeAll(async () => {
    const userId = await getTestUserId(admin);
    // כל שדות החובה של הטופס מלאים, כדי שהשמירה לא תיחסם בוולידציה
    const { data, error } = await admin
      .from("students")
      .insert({
        user_id: userId,
        first_name: "גלריה",
        last_name: `בדיקה${Date.now()}`,
        identity_number: `9${String(Date.now()).slice(-8)}`,
        birth_date: "1998-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        street: "רב שך",
        house: "5",
        cellphone_type: "kosher",
        in_shidduchim: true,
        // קו״ח שמור: השמירה חייבת לעבור בלי להעלות אותו מחדש, ולא למחוק אותו
        cv_url: EXISTING_CV_URL,
        parents_info: {
          father: {
            self: NAME,
            phone: "0501234567",
            job: "מלמד",
            grandFather: NAME,
            grandMother: NAME,
          },
          mother: {
            self: NAME,
            maidenName: "לוי",
            phone: "0507654321",
            job: "מורה",
            grandFather: NAME,
            grandMother: NAME,
          },
        },
        family_info: {
          numberOfChildren: "5",
          currentChildPlace: "3",
          about: "משפחה",
        },
        author_info: { name: "ממלא", phone: "0521234567", relation: "אב" },
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
    }
    studentId = data.id as string;
    seedPath = `${studentId}/photos/seed.png`;

    const { error: prefError } = await admin
      .from("partner_preferences")
      .insert({ student_id: studentId, additional_information: "מידע לשדכן" });
    if (prefError) throw new Error(`העדפות: ${prefError.message}`);

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(seedPath, TINY_PNG, { contentType: "image/png" });
    if (uploadError) throw new Error(`העלאת תמונה: ${uploadError.message}`);

    const { error: photoError } = await admin
      .from("student_photos")
      .insert({ student_id: studentId, storage_path: seedPath, position: 0 });
    if (photoError) throw new Error(`שורת תמונה: ${photoError.message}`);
  });

  test.afterAll(async () => {
    if (!studentId) return;
    const { data: files } = await admin.storage
      .from(BUCKET)
      .list(`${studentId}/photos`);
    const paths = (files ?? []).map(
      (file) => `${studentId}/photos/${file.name}`,
    );
    if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths);
    // student_photos ו-partner_preferences נמחקות ב-cascade
    await admin.from("students").delete().eq("id", studentId);
  });

  test("תמונה חדשה שהוגדרה כראשית נשמרת במקום הראשון", async ({ page }) => {
    // קומפילציית dev של העריכה והעמוד שאחריה, העלאה ושמירה - מעבר ל-30s
    test.setTimeout(90_000);

    // Arrange
    await page.goto(`/app/students/${studentId}/edit`);
    const steps = page.locator("nav").filter({ hasText: "פרטים אישיים" });
    await steps
      .getByRole("button", { name: "פרטים אישיים", exact: true })
      .click();
    const gallery = page.locator("ul").filter({ hasText: "הוספת תמונות" });
    await expect(gallery.getByText("תמונה ראשית")).toBeVisible({
      timeout: 15_000,
    });
    await expect(gallery.locator("li")).toHaveCount(2); // שמורה + אריח הוספה

    // תמונה גדולה מלאה רעש - נדחסת גרוע, ולכן בודקת גם את לולאת ההקטנה
    const largePhoto = await page.evaluate(
      ({ size }) => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d")!;
        const pixels = context.createImageData(size, size);
        for (let i = 0; i < pixels.data.length; i += 4) {
          pixels.data[i] = Math.random() * 255;
          pixels.data[i + 1] = Math.random() * 255;
          pixels.data[i + 2] = Math.random() * 255;
          pixels.data[i + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { size: LARGE_PHOTO_SIZE_PX },
    );
    const largePhotoBuffer = Buffer.from(largePhoto, "base64");
    expect(largePhotoBuffer.byteLength).toBeGreaterThan(MAX_STORED_BYTES);

    // Act
    await gallery.getByLabel("בחירת תמונות").setInputFiles({
      name: "new-photo.png",
      mimeType: "image/png",
      buffer: largePhotoBuffer,
    });
    await expect(gallery.getByAltText("תמונה חדשה 2")).toBeVisible();
    await gallery.getByRole("button", { name: "הגדרה כתמונה ראשית" }).click();
    await expect(gallery.getByAltText("תמונה חדשה 1")).toBeVisible();

    // השלב האחרון - הכותרת שלו מגדרית, ולכן לפי מיקום ולא לפי טקסט
    await steps.getByRole("button").last().click();
    await page.getByRole("button", { name: "שמירת השינויים" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/students/${studentId}$`), {
      timeout: 20_000,
    });

    // Assert
    const { data: rows, error } = await admin
      .from("student_photos")
      .select("storage_path, position")
      .eq("student_id", studentId)
      .order("position", { ascending: true });
    expect(error).toBeNull();
    expect(rows).toHaveLength(2);
    // התמונה הוקטנה בדפדפן ונשמרה כ-JPEG
    expect(rows?.[0].storage_path).toMatch(
      new RegExp(`^${studentId}/photos/.+\\.jpg$`),
    );
    expect(rows?.[0].storage_path).not.toBe(seedPath);
    expect(rows?.[1]).toEqual({ storage_path: seedPath, position: 1 });

    const newFileName = rows![0].storage_path.split("/").pop();
    const { data: files } = await admin.storage
      .from(BUCKET)
      .list(`${studentId}/photos`);
    const stored = files?.find((file) => file.name === newFileName);
    expect(stored?.metadata?.mimetype).toBe("image/jpeg");
    expect(stored?.metadata?.size).toBeLessThanOrEqual(MAX_STORED_BYTES);

    const { data: student } = await admin
      .from("students")
      .select("photo_count, cv_url")
      .eq("id", studentId)
      .single();
    expect(student?.photo_count).toBe(2);
    expect(student?.cv_url).toBe(EXISTING_CV_URL);
  });
});
