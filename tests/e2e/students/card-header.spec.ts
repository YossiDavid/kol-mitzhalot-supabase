import { test, expect, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
} from "../shidduchim/fixtures";

/**
 * הדר הכרטיס נבנה מחדש: פעולה ראשית אחת ותפריט "עוד פעולות". הבדיקה שומרת
 * על שני הדברים שנשברו קודם - עומס הפקדים בהדר, ועדכון הסטטוס שהיה נפרש
 * כשורה שלמה של כפתורים במקום פקד אחד שנפתח.
 */
const ACTIONS_BAR = '[data-slot="student-card-actions"]';
const MAX_HEADER_CONTROLS = 3;
const CV_URL = "https://example.com/cv-test.pdf";

async function openActionsMenu(page: Page) {
  await page.getByRole("button", { name: "עוד פעולות" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}

test.describe("הדר כרטיס המיועד — שדכן", () => {
  const admin = createServiceClient();
  const lastName = `הדר${Date.now()}`;
  let studentId: string;
  let cardUrl: string;

  test.beforeAll(async () => {
    const ownerId = await ensureCardManagerId(admin);
    const { data, error } = await admin
      .from("students")
      .insert({
        user_id: ownerId,
        first_name: "בדיקת",
        last_name: lastName,
        birth_date: "1998-01-01",
        gender: "male",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
        cv_url: CV_URL,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`יצירת כרטיס הבדיקה נכשלה: ${error?.message}`);
    }
    studentId = data.id as string;
    cardUrl = `/app/students/${studentId}`;
  });

  test.afterAll(async () => {
    await admin.from("students").delete().eq("id", studentId);
  });

  test("ההדר מציג לכל היותר שלושה פקדים", async ({ page }) => {
    // Arrange
    await page.goto(cardUrl);
    await expect(page.locator("h1")).toContainText(lastName);

    // Act
    const controls = page.locator(`${ACTIONS_BAR} button, ${ACTIONS_BAR} a`);

    // Assert
    expect(await controls.count()).toBeLessThanOrEqual(MAX_HEADER_CONTROLS);
    await expect(
      page.locator(ACTIONS_BAR).getByText("חזרה לרשימה"),
    ).toBeVisible();
    await expect(
      page.locator(ACTIONS_BAR).getByRole("link", { name: "עריכה" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "עוד פעולות" }),
    ).toBeVisible();
  });

  test("שאר הפעולות זמינות בתפריט, והמחיקה אינה מוצגת לשדכן", async ({
    page,
  }) => {
    // Arrange
    await page.goto(cardUrl);
    await expect(page.locator("h1")).toContainText(lastName);

    // Act
    await openActionsMenu(page);

    // Assert - כל מה שהיה בהדר לפני השינוי נשאר נגיש
    await expect(
      page.getByRole("menuitem", { name: "קובץ קו״ח" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "שיתוף הכרטיס" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "פניה למנהל הכרטיס" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "עדכון סטטוס" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "מחיקת כרטיס" }),
    ).toHaveCount(0);
  });

  test("עדכון סטטוס הוא פקד אחד שנפתח ומעדכן את המסד", async ({ page }) => {
    // Arrange
    await page.goto(cardUrl);
    await expect(page.locator("h1")).toContainText(lastName);
    await openActionsMenu(page);

    // Act
    await page.getByRole("menuitem", { name: "עדכון סטטוס" }).click();
    await expect(
      page.getByRole("menuitemradio", { name: "רווק", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("menuitemradio", { name: "מאורס", exact: true })
      .click();

    // Assert
    await expect(page.getByText("הסטטוס עודכן בהצלחה")).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("students")
            .select("personal_status, in_shidduchim")
            .eq("id", studentId)
            .single();
          return data?.personal_status;
        },
        { timeout: 10_000 },
      )
      .toBe("engaged");
  });

  test("הסטטוס שבמסד מסומן בתפריט, וכל סטטוס מופיע פעם אחת", async ({
    page,
  }) => {
    // Arrange - מחזירים לרווק כדי שהבדיקה תהיה עצמאית בסדר הרצה כלשהו
    await admin
      .from("students")
      .update({ personal_status: "single", in_shidduchim: true })
      .eq("id", studentId);
    await page.goto(cardUrl);
    await expect(page.locator("h1")).toContainText(lastName);

    // Act
    await openActionsMenu(page);
    await page.getByRole("menuitem", { name: "עדכון סטטוס" }).click();

    // Assert - חמישה סטטוסים, בלי כפילות של "רווק", והנוכחי מסומן
    const options = page.getByRole("menuitemradio");
    await expect(options).toHaveCount(5);
    await expect(
      page.getByRole("menuitemradio", { name: "רווק", exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("menuitemradio", { name: "רווק", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
  });
});
