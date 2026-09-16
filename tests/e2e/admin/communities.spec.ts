import { expect, test, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * מסך ניהול החסידויות והקהילות (/app/admin/communities).
 *
 * הערך של "חסידות או קהילה" נשמר בכרטיס כטקסט חופשי, ו-public.communities
 * הוא מקור הצעות בלבד. המסך מנהל את המאגר הזה: הוספה, שינוי שם, השבתה,
 * מחיקה (רק כשהערך אינו בשימוש) ומיזוג כפילויות - שהוא היחיד מביניהם שנוגע
 * בנתוני הכרטיסים עצמם.
 *
 * הבדיקות מקימות לעצמן את כל מה שהן צריכות ומנקות אותו ב-afterAll, כולל
 * כרטיסי המיועדים שנוצרו לבדיקת המיזוג.
 */

/** מצב ההתחברות של משתמש הבדיקה הרגיל (נוצר ב-tests/e2e/auth.setup.ts) */
const USER_AUTH_FILE = "playwright/.auth/user.json";

const STAMP = Date.now();
const CREATED_NAME = `קהילת בדיקה ${STAMP}`;
const RENAMED_NAME = `קהילת בדיקה מעודכנת ${STAMP}`;
const MERGE_SOURCE = `מקור מיזוג ${STAMP}`;
const MERGE_TARGET = `יעד מיזוג ${STAMP}`;
const SEEDED_COMMUNITIES = ["בעלזא", "צאנז", "קרלין", "ויז׳ניץ"];

const TEST_COMMUNITY_NAMES = [
  CREATED_NAME,
  RENAMED_NAME,
  MERGE_SOURCE,
  MERGE_TARGET,
];

const admin = createServiceClient();

/** מזהי המיועדים שנוצרו כאן - נמחקים לפני הקהילות, כי שימוש חוסם מחיקה */
let studentIds: string[] = [];

async function createStudent(
  userId: string,
  community: string,
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: "מיועד",
      last_name: `מיזוג ${STAMP}`,
      birth_date: "1998-01-01",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: "בני ברק",
      in_shidduchim: true,
      community,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `יצירת מיועד לבדיקה נכשלה: ${error?.message ?? "לא הוחזרה שורה"}`,
    );
  }

  return data.id as string;
}

/** פותח את בורר "חסידות או קהילה" בטופס המיועד, כמו community-catalog.spec */
async function openCommunityPicker(page: Page) {
  await page.goto("/app/students/create");
  await page.getByRole("radio", { name: "מיועד", exact: true }).check();
  await page.getByRole("button", { name: "המשך לשלב הבא" }).click();
  const cell = page.locator('[data-field-name="community"]');
  await expect(cell).toBeVisible();
  await cell.getByRole("combobox").click();
}

test.afterAll(async () => {
  if (studentIds.length > 0) {
    await admin.from("education_history").delete().in("student_id", studentIds);
    const { error } = await admin
      .from("students")
      .delete()
      .in("id", studentIds);
    if (error) {
      throw new Error(`ניקוי מיועדי הבדיקה נכשל: ${error.message}`);
    }
    studentIds = [];
  }

  const { error } = await admin
    .from("communities")
    .delete()
    .in("name", TEST_COMMUNITY_NAMES);
  if (error) {
    throw new Error(`ניקוי קהילות הבדיקה נכשל: ${error.message}`);
  }
});

test.describe("ניהול חסידויות וקהילות", () => {
  test("מנהל רואה את המסך ואת ערכי ברירת המחדל", async ({ page }) => {
    // Arrange + Act
    await page.goto("/app/admin/communities");

    // Assert
    await expect(
      page.getByRole("heading", { name: "חסידויות וקהילות", level: 1 }),
    ).toBeVisible();

    const table = page.getByRole("table");
    for (const name of SEEDED_COMMUNITIES) {
      await expect(table.getByRole("cell", { name, exact: true })).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test("קהילה חדשה נוספת למאגר", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/communities");
    await page.getByRole("button", { name: "קהילה חדשה" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("שם החסידות או הקהילה")).toBeVisible();

    // Act
    await dialog.getByLabel("שם החסידות או הקהילה").fill(CREATED_NAME);
    await dialog.getByRole("button", { name: "שמירה" }).click();

    // Assert
    await expect(page.getByText("הקהילה נוספה למאגר")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("table").getByText(CREATED_NAME)).toBeVisible({
      timeout: 15_000,
    });

    const { data } = await admin
      .from("communities")
      .select("name, is_active")
      .eq("name", CREATED_NAME)
      .single();
    expect(data?.is_active).toBe(true);
  });

  test("שינוי שם הקהילה נשמר", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/communities");
    await page
      .getByRole("button", { name: `עריכה: ${CREATED_NAME}` })
      .click({ timeout: 15_000 });
    const dialog = page.getByRole("dialog");

    // Act
    await dialog.getByLabel("שם החסידות או הקהילה").fill(RENAMED_NAME);
    await dialog.getByRole("button", { name: "שמירה" }).click();

    // Assert
    await expect(page.getByText("הקהילה עודכנה")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("table").getByText(RENAMED_NAME)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("קהילה לא פעילה נעלמת מהבורר בטופס ונשארת במסך המנהל", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app/admin/communities");
    await page
      .getByRole("button", { name: `עריכה: ${RENAMED_NAME}` })
      .click({ timeout: 15_000 });
    const dialog = page.getByRole("dialog");

    // Act
    await dialog.getByLabel("קהילה פעילה").click();
    await dialog.getByRole("button", { name: "שמירה" }).click();
    await expect(page.getByText("הקהילה עודכנה")).toBeVisible({
      timeout: 15_000,
    });

    // Assert - המנהל עדיין רואה את הערך, מסומן כלא פעיל
    const row = page.getByRole("row").filter({ hasText: RENAMED_NAME });
    await expect(row).toContainText("לא פעילה", { timeout: 15_000 });

    // Assert - הבורר בטופס אינו מציע אותו, אלא מציע להוסיף אותו מחדש
    await openCommunityPicker(page);
    await page.getByPlaceholder("חיפוש...").fill(RENAMED_NAME);
    await expect(
      page.getByRole("option", {
        name: new RegExp(`הוספה למאגר.*${RENAMED_NAME}`),
      }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("מיזוג מעביר את הטקסט שבכרטיסים ומדווח על מספר השורות", async ({
    page,
  }) => {
    // Arrange - שתי קהילות כפולות, שני כרטיסים ושורת השכלה אחת
    const { error: insertError } = await admin
      .from("communities")
      .insert([{ name: MERGE_SOURCE }, { name: MERGE_TARGET }]);
    if (insertError) {
      throw new Error(`הכנת קהילות המיזוג נכשלה: ${insertError.message}`);
    }

    const ownerId = await ensureCardManagerId(admin);
    const exactStudentId = await createStudent(ownerId, MERGE_SOURCE);
    // רווח בסוף: ההשוואה במסד היא lower(btrim(name)), ולכן גם הוא נספר ועובר
    const paddedStudentId = await createStudent(ownerId, `${MERGE_SOURCE} `);
    studentIds = [exactStudentId, paddedStudentId];

    const { error: educationError } = await admin
      .from("education_history")
      .insert({
        student_id: exactStudentId,
        institution_type: "yeshiva_gdola",
        name: `ישיבת בדיקה ${STAMP}`,
        community: MERGE_SOURCE,
      });
    if (educationError) {
      throw new Error(`הכנת שורת ההשכלה נכשלה: ${educationError.message}`);
    }

    // Act
    await page.goto("/app/admin/communities");
    await page
      .getByRole("button", { name: `מיזוג: ${MERGE_SOURCE}` })
      .click({ timeout: 15_000 });
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("קהילת יעד").selectOption({ label: MERGE_TARGET });

    // Assert - התצוגה המקדימה סופרת את שלוש הרשומות
    await expect(dialog.getByText(/3 רשומות/)).toBeVisible();

    await dialog.getByRole("button", { name: "מיזוג הקהילות" }).click();

    // Assert - ההודעה מדווחת על מספר השורות שעודכנו
    await expect(page.getByText("הקהילות מוזגו: 3 רשומות עודכנו")).toBeVisible({
      timeout: 15_000,
    });

    // Assert - הטקסט בכרטיסים עבר לשם היעד
    const { data: students } = await admin
      .from("students")
      .select("id, community")
      .in("id", studentIds);
    expect(students?.map((student) => student.community).sort()).toEqual([
      MERGE_TARGET,
      MERGE_TARGET,
    ]);

    const { data: education } = await admin
      .from("education_history")
      .select("community")
      .eq("student_id", exactStudentId);
    expect(education?.[0]?.community).toBe(MERGE_TARGET);

    // Assert - קהילת המקור נמחקה מהמאגר
    const { data: source } = await admin
      .from("communities")
      .select("id")
      .eq("name", MERGE_SOURCE)
      .maybeSingle();
    expect(source).toBeNull();
  });
});

/**
 * המסך חסום למי שאינו מנהל. הבדיקה רצה עם מצב ההתחברות של משתמש הבדיקה
 * הרגיל (הפרויקט chromium), ולא של המנהל - אף שהקובץ עצמו יושב תחת
 * tests/e2e/admin ולכן נאסף בפרויקט chromium-admin.
 */
test.describe("ללא הרשאת מנהל", () => {
  test.use({ storageState: USER_AUTH_FILE });

  test("משתמש רגיל מנותב משם ואינו רואה את המסך", async ({ page }) => {
    // Arrange + Act
    await page.goto("/app/admin/communities");

    // Assert
    await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "חסידויות וקהילות", level: 1 }),
    ).toHaveCount(0);
  });
});
