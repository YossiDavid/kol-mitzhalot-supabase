import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
  TEST_USER_EMAIL,
} from "../shidduchim/fixtures";
import { approvedCard } from "../helpers/approved-card";

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
const BACK_STREET = "רחוב האזהרה";
const NICKNAME = "בערל";
const AUTHOR_EMAIL = "author-edit@example.test";
const NEW_AUTHOR_EMAIL = "author-added@example.test";
const AUTHOR_EMAIL_MISSING_MESSAGE = "נא למלא אימייל של ממלא/ת הכרטיס";
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
    .insert(
      approvedCard({
        user_id: userId,
        first_name: "שמירה",
        last_name: `בכלשלב${RUN_ID}`,
        identity_number: `7${String(RUN_ID).slice(-8)}`,
        // כרטיס שנוצר בלי card_for נחסם בעריכה עד שנבחר עבור מי הוא
        card_for: "child",
        birth_date: "1997-03-03",
        // אשה: בכרטיס של גבר התמונה חובה, והבדיקה אינה עוסקת בתמונות
        gender: "female",
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
        author_info: {
          name: "כותב הבדיקה",
          phone: "0503333333",
          email: AUTHOR_EMAIL,
          relation: "אב",
        },
      }),
    )
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
    .select("street, nickname, cv_url, parents_info")
    .eq("id", studentId)
    .single();
  if (error || !data) {
    throw new Error(`קריאת הכרטיס נכשלה: ${error?.message}`);
  }
  return data as {
    street: string | null;
    nickname: string | null;
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
  await stepsNav(page)
    .getByRole("button", { name: title, exact: true })
    .click();
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
    await expect(page).toHaveURL(
      new RegExp(`/app/students/${studentId}/edit$`),
    );
    await expect(
      page.getByRole("heading", { name: PERSONAL_STEP }),
    ).toBeVisible();
    await expect(page.locator("#street")).toHaveValue("חזון איש");
    expect((await readStudent()).street).toBe("חזון איש");
  });

  // הכינוי נשמר רק אם שתי פונקציות השמירה מכירות את העמודה: הן מונות
  // עמודות במפורש, וערך שלא נמנה בהן נשלח מהטופס ונזרק בשקט.
  test("כינוי: נשמר במסד ונשאר בשדה אחרי שמירה", async ({ page }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange
    await page.goto(`/app/students/${studentId}/edit`);
    await openStep(page, PERSONAL_STEP);
    await expect(page.locator("#nickname")).toBeVisible();

    // Act
    await page.locator("#nickname").fill(NICKNAME);
    await saveAndWaitForBaseline(page);

    // Assert
    await expect(page.locator("#nickname")).toHaveValue(NICKNAME);
    expect((await readStudent()).nickname).toBe(NICKNAME);
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
    await expect(
      page.getByRole("heading", { name: FAMILY_STEP }),
    ).toBeVisible();
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

  test("קו״ח שהועלה בשמירה אחת לא מועלה שוב בשמירה הבאה", async ({ page }) => {
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

  test("'אחורה' בדפדפן שואל על שינויים שלא נשמרו, ואחרי שמירה יוצא מיד", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange - נכנסים לעריכה מדף אחר, כדי שיהיה לאן לחזור
    await page.goto("/app/students");
    await page.goto(`/app/students/${studentId}/edit`);
    await openStep(page, PERSONAL_STEP);

    // Act - שינוי שלא נשמר, "אחורה", ובחירה להישאר
    await page.locator("#street").fill(BACK_STREET);
    await expect(page.getByText("יש שינויים שלא נשמרו")).toBeVisible();

    // אירוע ה-dialog נמסר ללקוח אחרי ש-goBack נפתר, ולכן ממתינים לו במפורש
    const confirmDialog = page.waitForEvent("dialog");
    await page.goBack();
    const dialog = await confirmDialog;

    // Assert - נשארנו בדף העריכה, והשינוי לא אבד
    expect(dialog.message()).toContain("יש שינויים שלא נשמרו");
    // ביטול = "להישאר בדף"
    await dialog.dismiss();
    await expect(page).toHaveURL(
      new RegExp(`/app/students/${studentId}/edit$`),
    );
    await expect(page.locator("#street")).toHaveValue(BACK_STREET);
    await expect(
      page.getByRole("heading", { name: PERSONAL_STEP }),
    ).toBeVisible();

    // Act - שמירה, ואז "אחורה" נוסף. בלי שינויים אין מה לאשר
    await saveAndWaitForBaseline(page);
    let didAsk = false;
    // שאלה כאן הייתה משאירה אותנו בדף, ואז בדיקת הכתובת שלמטה נופלת
    page.on("dialog", async (strayDialog) => {
      didAsk = true;
      await strayDialog.dismiss();
    });
    await page.goBack();

    // Assert - יציאה מיידית בלחיצה אחת, בלי שאלה
    await expect(page).toHaveURL(/\/app\/students$/);
    expect(didAsk).toBe(false);
    expect((await readStudent()).street).toBe(BACK_STREET);
  });

  // כרטיס ישן שנשמר לפני שאימייל הממלא נדרש נטען כרגיל. הבעלים מקבל את
  // אימייל החשבון שלו מראש (כמו ביצירה) ויכול לעבור ישר לשלב מאוחר ולשמור;
  // עורך שאינו הבעלים לא חייב לנחש את האימייל של הממלא
  const OLD_AUTHOR_INFO = {
    name: "כותב הבדיקה",
    phone: "0503333333",
    relation: "אב",
  };

  const readAuthorInfo = async () => {
    const { data } = await admin
      .from("students")
      .select("author_info")
      .eq("id", studentId)
      .single();
    return data?.author_info as Record<string, unknown> | null;
  };

  const seedOldCard = (extra: Record<string, unknown> = {}) =>
    admin
      .from("students")
      .update({ author_info: OLD_AUTHOR_INFO, ...extra })
      .eq("id", studentId);

  test("כרטיס ישן, בעלים: האימייל מתמלא מראש, עוברים ישר לשלב מאוחר, והוא נשמר", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange - כרטיס ישן: author_info בלי email
    await seedOldCard();
    await page.goto(`/app/students/${studentId}/edit`);

    // Assert - מולא מראש באימייל החשבון
    await expect(page.locator("#author-email")).toHaveValue(TEST_USER_EMAIL);

    // Act - ישר לשלב מאוחר ושמירה
    await openStep(page, PERSONAL_STEP);
    await page.locator("#street").fill("רחוב האימייל");
    await saveAndWaitForBaseline(page);

    // Assert
    expect(await readAuthorInfo()).toMatchObject({ email: TEST_USER_EMAIL });
  });

  test("כרטיס ישן, בעלים: מחיקת האימייל נחסמת בהודעה על השדה", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange
    await seedOldCard();
    await page.goto(`/app/students/${studentId}/edit`);
    await page.locator("#author-email").fill("");

    // Act
    await stepsNav(page)
      .getByRole("button", { name: PERSONAL_STEP, exact: true })
      .click();

    // Assert - ההודעה על השדה, ולא עברנו שלב
    await expect(page.getByText(AUTHOR_EMAIL_MISSING_MESSAGE)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: PERSONAL_STEP }),
    ).toHaveCount(0);
  });

  test("כרטיס ישן, עורך שאינו הבעלים: השדה ריק ולא חובה, נשמר בלי אימייל", async ({
    page,
  }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange - הכרטיס שייך למשתמש אחר; משתמש הבדיקה (שדכן) עורך אותו
    const testUserId = await getTestUserId(admin);
    const ownerId = await ensureCardManagerId(admin);
    await seedOldCard({ user_id: ownerId });
    try {
      await page.goto(`/app/students/${studentId}/edit`);

      // Assert - לא מולא באימייל העורך, ואינו מסומן כחובה
      await expect(page.locator("#author-email")).toHaveValue("");
      await expect(
        page.locator('[data-field-name="author.email"] label'),
      ).not.toContainText("*");

      // Act - שינוי בשלב אחר ושמירה
      await openStep(page, PERSONAL_STEP);
      await page.locator("#street").fill("רחוב העורך");
      await saveAndWaitForBaseline(page);

      // Assert - נשמר, ואימייל הממלא נשאר חסר
      expect(await readAuthorInfo()).not.toHaveProperty("email");
      expect((await readStudent()).street).toBe("רחוב העורך");
    } finally {
      await admin
        .from("students")
        .update({ user_id: testUserId })
        .eq("id", studentId);
    }
  });

  test("כרטיס ישן, בעלים: מילוי ידני של אימייל אחר נשמר", async ({ page }) => {
    test.setTimeout(SLOW_TEST_TIMEOUT_MS);

    // Arrange
    await seedOldCard();
    await page.goto(`/app/students/${studentId}/edit`);

    // Act
    await page.locator("#author-email").fill(NEW_AUTHOR_EMAIL);
    await saveAndWaitForBaseline(page);

    // Assert
    expect(await readAuthorInfo()).toMatchObject({ email: NEW_AUTHOR_EMAIL });
  });
});
