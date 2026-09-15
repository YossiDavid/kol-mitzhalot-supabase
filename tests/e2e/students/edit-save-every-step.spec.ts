import { test, expect, type Locator, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * עריכת כרטיס: "שמירת שינויים" מכל שלב. השמירה מאמתת את כל הטופס, נשארת
 * בשלב, והנתונים השמורים הופכים לנקודת הייחוס - הכפתור ננעל שוב, וקובץ
 * שהועלה לא מועלה פעם נוספת בשמירה הבאה.
 */

const admin = createServiceClient();
const BUCKET = "students";
const RUN_ID = Date.now();
const PERSONAL_STEP = "פרטים אישיים";
const FAMILY_STEP = "על המשפחה";
const SAVE_BUTTON = "שמירת שינויים";
const SUCCESS_MESSAGE = "השינויים נשמרו בהצלחה!";
const INVALID_SAVE_MESSAGE = /השינויים לא נשמרו: יש שדות שצריך להשלים/;
const FATHER_NAME = "אברהם";
const CV_FILE_PATTERN = /-cv\.pdf$/;
// קומפילציית dev של דף העריכה, העלאות ושמירות חוזרות - מעבר ל-30s
const SLOW_TEST_TIMEOUT_MS = 90_000;
const SAVE_TIMEOUT_MS = 20_000;

let studentId: string;

const nameParts = (name: string) => ({ prefix: "", name, suffix: "" });

/** כרטיס רווק שעובר את כל שדות החובה בטופס, בבעלות משתמש הבדיקה */
async function createCompleteStudent(): Promise<string> {
  const userId = await getTestUserId(admin);
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: "שמירה",
      last_name: `בכלשלב${RUN_ID}`,
      identity_number: `7${String(RUN_ID).slice(-8)}`,
      birth_date: "1997-03-03",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      street: "רבי עקיבא",
      house: "12",
      cellphone_type: "kosher",
      in_shidduchim: true,
      parents_info: {
        father: {
          self: nameParts(FATHER_NAME),
          phone: "0501111111",
          job: "מלמד",
          email: "",
          grandFather: nameParts("יצחק"),
          grandMother: nameParts("שרה"),
        },
        mother: {
          self: nameParts("רחל"),
          maidenName: "לוי",
          phone: "0502222222",
          job: "מורה",
          email: "",
          grandFather: nameParts("יעקב"),
          grandMother: nameParts("לאה"),
        },
      },
      family_info: {
        numberOfChildren: 6,
        currentChildPlace: 2,
        about: "משפחה תורנית",
        mechutanim: [],
      },
      author_info: { name: "כותב הבדיקה", phone: "0503333333", relation: "אב" },
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
  }
  const id = data.id as string;

  const { error: preferencesError } = await admin
    .from("partner_preferences")
    .insert({ student_id: id, additional_information: "מחפשים בת תורה" });
  if (preferencesError) {
    throw new Error(`הכנת העדפות הכרטיס נכשלה: ${preferencesError.message}`);
  }
  return id;
}

async function readStudent() {
  const { data, error } = await admin
    .from("students")
    .select("street, cv_url, parents_info")
    .eq("id", studentId)
    .single();
  if (error || !data) {
    throw new Error(`קריאת הכרטיס נכשלה: ${error?.message}`);
  }
  return data as {
    street: string | null;
    cv_url: string | null;
    parents_info: { father?: { self?: { name?: string } } } | null;
  };
}

async function listStoredCvFiles(): Promise<string[]> {
  const { data, error } = await admin.storage.from(BUCKET).list(studentId);
  if (error) throw new Error(`קריאת האחסון נכשלה: ${error.message}`);
  return (data ?? [])
    .map((file) => file.name)
    .filter((name) => CV_FILE_PATTERN.test(name));
}

async function removeStoredFiles() {
  const folders = [studentId, `${studentId}/medical`, `${studentId}/photos`];
  for (const folder of folders) {
    const { data } = await admin.storage.from(BUCKET).list(folder);
    const paths = (data ?? [])
      // תיקייה מוחזרת בלי id
      .filter((file) => file.id)
      .map((file) => `${folder}/${file.name}`);
    if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths);
  }
}

const stepsNav = (page: Page) =>
  page.getByRole("navigation", { name: "שלבי הטופס" });

async function openStep(page: Page, title: string) {
  await stepsNav(page).getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

const saveButton = (page: Page): Locator =>
  page.getByRole("button", { name: SAVE_BUTTON, exact: true });

/** לוחץ על שמירה ומחכה שהנתונים השמורים יחזרו והכפתור יינעל שוב */
async function saveAndWaitForBaseline(page: Page) {
  await expect(saveButton(page)).toBeEnabled();
  await saveButton(page).click();
  // השדות נעולים (aria-busy) עד שהנתונים השמורים חזרו מהשרת והטופס אופס
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: SAVE_TIMEOUT_MS,
  });
  await expect(saveButton(page)).toBeDisabled();
  await expect(page.getByText("יש שינויים שלא נשמרו")).toHaveCount(0);
}

test.describe.serial("שמירת שינויים מכל שלב בעריכת כרטיס", () => {
  test.beforeAll(async () => {
    studentId = await createCompleteStudent();
  });

  test.afterAll(async () => {
    if (!studentId) return;
    await removeStoredFiles();
    // partner_preferences נמחקת ב-cascade
    await admin.from("students").delete().eq("id", studentId);
  });

  test("שמירה מאמצע האשף נשארת בשלב, מעדכנת את המסד ונועלת את הכפתור", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange
    await page.goto(`/app/students/${studentId}/edit`);
    await openStep(page, PERSONAL_STEP);
    await expect(saveButton(page)).toBeDisabled();

    // Act
    await page.locator("#street").fill("חזון איש");
    await expect(page.getByText("יש שינויים שלא נשמרו")).toBeVisible();
    await saveButton(page).click();

    // Assert
    await expect(page.getByText(SUCCESS_MESSAGE).first()).toBeVisible({
      timeout: SAVE_TIMEOUT_MS,
    });
    await expect(saveButton(page)).toBeDisabled({ timeout: SAVE_TIMEOUT_MS });
    await expect(page).toHaveURL(new RegExp(`/app/students/${studentId}/edit$`));
    await expect(
      page.getByRole("heading", { name: PERSONAL_STEP }),
    ).toBeVisible();
    await expect(page.locator("#street")).toHaveValue("חזון איש");
    expect((await readStudent()).street).toBe("חזון איש");
  });

  test("שגיאה בשלב אחר: השמירה עוברת לשדה השגוי ולא נשמרת", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange - שדה חובה מתרוקן בשלב המשפחה, והשמירה נלחצת משלב אחר
    await page.goto(`/app/students/${studentId}/edit`);
    await openStep(page, FAMILY_STEP);
    await page.locator("#father-self").fill("");
    await openStep(page, PERSONAL_STEP);
    await page.locator("#street").fill("רחוב שלא יישמר");

    // Act
    await saveButton(page).click();

    // Assert
    await expect(page.getByText(INVALID_SAVE_MESSAGE)).toBeVisible();
    await expect(page.getByRole("heading", { name: FAMILY_STEP })).toBeVisible();
    await expect(page.locator("#father-self")).toBeFocused();
    await expect(page.locator("#father-self")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(saveButton(page)).toBeEnabled();
    const student = await readStudent();
    expect(student.street).toBe("חזון איש");
    expect(student.parents_info?.father?.self?.name).toBe(FATHER_NAME);
  });

  test("קו״ח שהועלה בשמירה אחת לא מועלה שוב בשמירה הבאה", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange
    await page.goto(`/app/students/${studentId}/edit`);
    await openStep(page, PERSONAL_STEP);
    const cvCell = page.locator('[data-field-name="cv"]');
    await cvCell.locator('input[type="file"]').setInputFiles({
      name: "new-cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n%%EOF"),
    });

    // Act - שמירה ראשונה עם הקובץ
    await saveAndWaitForBaseline(page);

    // Assert - הקובץ הפך ל"קיים" בטופס
    await expect(cvCell.getByText("קובץ קו״ח קיים")).toBeVisible();
    await expect(
      cvCell.getByText("הקובץ החדש שבחרתם יחליף אותו בשמירה."),
    ).toHaveCount(0);
    expect(await listStoredCvFiles()).toHaveLength(1);
    const firstCvUrl = (await readStudent()).cv_url;
    expect(firstCvUrl).toMatch(new RegExp(`/${studentId}/\\d+-cv\\.pdf\\?`));

    // Act - שינוי אחר ושמירה שנייה
    await page.locator("#street").fill("סוקולוב");
    await saveAndWaitForBaseline(page);

    // Assert
    const student = await readStudent();
    expect(student.street).toBe("סוקולוב");
    expect(student.cv_url).toBe(firstCvUrl);
    expect(await listStoredCvFiles()).toHaveLength(1);
  });
});
