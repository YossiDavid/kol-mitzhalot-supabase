import { test, expect, type Page } from "@playwright/test";

import {
  createServiceClient,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

/**
 * "הערות שדכן" פרטיות לשדכן שכתב אותן ואינן בשיתוף הכרטיס; "פידבק אנשי
 * צוות" גלוי לכל צופה - גם לא מחובר (קישור השיתוף) - עם שם הכותב.
 */
const admin = createServiceClient();
const STAFF_FEEDBACK = `מחמאה מאיש צוות ${Date.now()}`;
const OTHER_SHADCHAN_NOTE = `הערה של שדכן אחר ${Date.now()}`;
/** CARD_MANAGER ב-fixtures.ts - משמש כאן ככותב הפידבק */
const STAFF_AUTHOR_NAME = "Fixture Manager";

let fixtures: ShidduchFixtures;

async function insertNote(
  authorId: string,
  authorRole: "staff" | "shadchan",
  body: string,
): Promise<void> {
  const { error } = await admin.from("student_notes").insert({
    student_id: fixtures.groomFirst,
    author_id: authorId,
    author_role: authorRole,
    body,
  });
  if (error) throw new Error(`הכנת הערה לבדיקה נכשלה: ${error.message}`);
}

async function openCard(page: Page): Promise<void> {
  await page.goto(`/app/students/${fixtures.groomFirst}`);
  await expect(page.getByText("פידבק אנשי צוות").first()).toBeVisible({
    timeout: 15_000,
  });
}

test.beforeAll(async () => {
  fixtures = await setupShidduchFixtures(admin);
  await insertNote(fixtures.cardManagerId, "staff", STAFF_FEEDBACK);
  await insertNote(fixtures.otherShadchanId, "shadchan", OTHER_SHADCHAN_NOTE);
});

test.afterAll(async () => {
  // מחיקת המיועדים מוחקת את ההערות ב-cascade
  await teardownShidduchFixtures(admin, fixtures);
});

test.describe("שדכן מחובר", () => {
  test("רואה פידבק עם שם הכותב, לא רואה הערות של שדכן אחר, וכותב הערה פרטית", async ({
    page,
  }) => {
    // Arrange
    await openCard(page);

    // Assert - פידבק צוות גלוי עם שם, הערת שדכן אחר מוסתרת
    await expect(page.getByText(STAFF_FEEDBACK)).toBeVisible();
    await expect(page.getByText(STAFF_AUTHOR_NAME)).toBeVisible();
    await expect(page.getByText(OTHER_SHADCHAN_NOTE)).toHaveCount(0);

    // Act - כתיבת הערה פרטית
    const myNote = `הערה פרטית שלי ${Date.now()}`;
    const composer = page.getByPlaceholder("הערה פרטית על המיועד/ת...");
    await composer.fill(myNote);
    await page.getByRole("button", { name: "שמירת הערה" }).click();

    // Assert - ממתינים לפריט ברשימה (ולא לטקסט שעדיין בתיבה) לפני בדיקת המסד
    await expect(
      page.getByRole("listitem").filter({ hasText: myNote }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(composer).toHaveValue("");
    const { data, error } = await admin
      .from("student_notes")
      .select("author_role, author_id")
      .eq("student_id", fixtures.groomFirst)
      .eq("body", myNote)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.author_role).toBe("shadchan");
  });
});

test.describe("צופה לא מחובר (קישור שיתוף)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("רואה את פידבק הצוות ולא רואה הערות שדכן", async ({ page }) => {
    // Arrange + Act
    await openCard(page);

    // Assert
    await expect(page.getByText(STAFF_FEEDBACK)).toBeVisible();
    await expect(page.getByText(STAFF_AUTHOR_NAME)).toBeVisible();
    await expect(page.getByText(OTHER_SHADCHAN_NOTE)).toHaveCount(0);
    await expect(page.getByText("הערות שדכן")).toHaveCount(0);
  });
});
