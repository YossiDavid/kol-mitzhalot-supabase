import { test, expect, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * סינון "קהילה / חסידות" בסגנון אקסל: "הכל" מסומן כברירת מחדל, מבטלים סימון
 * למה שלא רוצים, או מנקים הכל ומסמנים רק מה שרוצים. כולל "ללא קהילה" וערך
 * חופשי עם תווים שמשבשים תחביר סינון (גרש, פסיק, סוגריים, מרכאות).
 */

const admin = createServiceClient();
const stamp = Date.now();
const LAST_NAME = `קהילות${stamp}`;
const TRICKY_COMMUNITY = `ויז׳ניץ (בדיקה, "${stamp}")`;
const PLAIN_COMMUNITY = `פשוטה${stamp}`;

const FIRST_TRICKY = `מסובכת${stamp}`;
const FIRST_PLAIN = `פשוט${stamp}`;
const FIRST_EMPTY = `ריק${stamp}`;
const FIRST_NULL = `נאל${stamp}`;

let studentIds: string[] = [];

async function createStudent(
  userId: string,
  firstName: string,
  community: string | null,
): Promise<string> {
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: firstName,
      last_name: LAST_NAME,
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
  if (error || !data) throw new Error(`יצירת מיועד נכשלה: ${error?.message}`);
  return data.id as string;
}

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  studentIds = [
    await createStudent(userId, FIRST_TRICKY, TRICKY_COMMUNITY),
    await createStudent(userId, FIRST_PLAIN, PLAIN_COMMUNITY),
    await createStudent(userId, FIRST_EMPTY, ""),
    await createStudent(userId, FIRST_NULL, null),
  ];
});

test.afterAll(async () => {
  await admin.from("students").delete().in("id", studentIds);
});

const rowOf = (page: Page, firstName: string) =>
  page.getByText(firstName).filter({ visible: true });

async function openFilter(page: Page) {
  await page.goto("/app/students");
  await page.locator("#search").fill(LAST_NAME);
  await expect(rowOf(page, FIRST_PLAIN).first()).toBeVisible({
    timeout: 10_000,
  });
  const trigger = page.locator("#community");
  await trigger.click();
  // ערך שבא רק מכרטיסים (לא במאגר) מוצע גם הוא
  await expect(
    page.getByRole("option", { name: TRICKY_COMMUNITY }),
  ).toBeVisible({ timeout: 10_000 });
  return trigger;
}

test.describe("סינון קהילה מרובה", () => {
  test("ברירת מחדל: הכל מסומן וכל הכרטיסים מוצגים", async ({ page }) => {
    // Arrange + Act
    const trigger = await openFilter(page);

    // Assert
    await expect(trigger).toHaveText("כל הקהילות");
    await expect(page.getByRole("checkbox", { name: "הכל" })).toBeChecked();
    for (const name of [FIRST_TRICKY, FIRST_PLAIN, FIRST_EMPTY, FIRST_NULL]) {
      await expect(rowOf(page, name).first()).toBeVisible();
    }
  });

  test("ביטול סימון של קהילה מסתיר רק אותה, וכרטיס בלי קהילה נשאר", async ({
    page,
  }) => {
    // Arrange
    const trigger = await openFilter(page);

    // Act
    await page.getByRole("option", { name: PLAIN_COMMUNITY }).click();

    // Assert
    await expect(trigger).toHaveText("ללא 1");
    await expect(rowOf(page, FIRST_PLAIN)).toHaveCount(0);
    await expect(rowOf(page, FIRST_TRICKY).first()).toBeVisible();
    await expect(rowOf(page, FIRST_EMPTY).first()).toBeVisible();
    await expect(rowOf(page, FIRST_NULL).first()).toBeVisible();
  });

  test("ניקוי הכל וסימון ערך עם תווים מיוחדים מציג רק אותו", async ({
    page,
  }) => {
    // Arrange
    const trigger = await openFilter(page);

    // Act
    await page.getByRole("checkbox", { name: "הכל" }).click();
    await page.getByRole("option", { name: TRICKY_COMMUNITY }).click();

    // Assert
    await expect(trigger).toHaveText("1 נבחרו");
    await expect(rowOf(page, FIRST_TRICKY).first()).toBeVisible();
    await expect(rowOf(page, FIRST_PLAIN)).toHaveCount(0);
    await expect(rowOf(page, FIRST_EMPTY)).toHaveCount(0);
    await expect(rowOf(page, FIRST_NULL)).toHaveCount(0);
  });

  test("ללא קהילה מציג גם NULL וגם מחרוזת ריקה", async ({ page }) => {
    // Arrange
    await openFilter(page);

    // Act
    await page.getByRole("checkbox", { name: "הכל" }).click();
    await page.getByRole("option", { name: "ללא קהילה" }).click();

    // Assert
    await expect(rowOf(page, FIRST_EMPTY).first()).toBeVisible();
    await expect(rowOf(page, FIRST_NULL).first()).toBeVisible();
    await expect(rowOf(page, FIRST_PLAIN)).toHaveCount(0);
    await expect(rowOf(page, FIRST_TRICKY)).toHaveCount(0);
  });

  test("החיפוש בתוך הרשימה, והשילוב עם סינונים אחרים", async ({ page }) => {
    // Arrange
    await openFilter(page);

    // Act - חיפוש מצמצם את הרשימה
    await page.getByPlaceholder("חיפוש קהילה...").fill(PLAIN_COMMUNITY);

    // Assert
    await expect(
      page.getByRole("option", { name: PLAIN_COMMUNITY }),
    ).toBeVisible();
    await expect(page.getByRole("option", { name: TRICKY_COMMUNITY })).toHaveCount(
      0,
    );

    // Act - רק הקהילה הפשוטה, ובנוסף מגדר שאינו תואם
    await page.getByRole("checkbox", { name: "הכל" }).click();
    await page.getByRole("option", { name: PLAIN_COMMUNITY }).click();
    await page.keyboard.press("Escape");
    await page.locator("#gender").selectOption("female");

    // Assert - כל הכרטיסים זכרים, ולכן אין תוצאות
    await expect(rowOf(page, FIRST_PLAIN)).toHaveCount(0);
  });

  test("ניקוי הסינון מחזיר את הכל מסומן", async ({ page }) => {
    // Arrange
    const trigger = await openFilter(page);
    await page.getByRole("option", { name: PLAIN_COMMUNITY }).click();
    await expect(trigger).toHaveText("ללא 1");
    await page.keyboard.press("Escape");

    // Act
    await page.getByRole("button", { name: "ניקוי הסינון" }).click();

    // Assert
    await expect(trigger).toHaveText("כל הקהילות");
  });
});
