import { test, expect, type Page } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * טבלת המיועדים המשותפת (DataTable): בדסקטופ טבלה סמנטית שכל שורה בה
 * פותחת את הכרטיס המלא, ובמובייל כרטיסים עם אותם נתונים - בלי טבלה.
 */
const TABLE_CAPTION = "רשימת המיועדים";
const FIRST_NAME = "טבלה";
const CITY = "רכסים";
const HEIGHT = 181;
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const admin = createServiceClient();
const lastName = `טבלה${Date.now()}`;
const cardLabel = `כרטיס מלא: ${FIRST_NAME} ${lastName}`;
let studentId: string;

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const { data, error } = await admin
    .from("students")
    .insert({
      user_id: userId,
      first_name: FIRST_NAME,
      last_name: lastName,
      birth_date: "1999-03-01",
      gender: "male",
      personal_status: "single",
      country: "ישראל",
      city: CITY,
      height: HEIGHT,
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
  await admin.from("students").delete().eq("id", studentId);
});

async function searchForTestStudent(page: Page, isMobile = false) {
  await page.goto("/app/students");
  if (!isMobile) {
    await page.locator("#search").fill(lastName);
    return;
  }
  // במובייל שדות הסינון נמצאים בפאנל שנפתח בלחיצה, עם קידומת m-
  await page.getByRole("button", { name: "חיפוש וסינון" }).click();
  await page.locator("#m-search").fill(lastName);
}

test.describe("טבלת המיועדים - דסקטופ", () => {
  test("מציגה טבלה עם כותרות, ולחיצה על שורה פותחת את הכרטיס", async ({
    page,
  }) => {
    // Arrange
    await searchForTestStudent(page);
    const table = page.getByRole("table", { name: TABLE_CAPTION });
    const row = table.getByRole("row", { name: cardLabel });

    // Assert - מבנה טבלה סמנטי
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(
      table.getByRole("columnheader", { name: "שם משפחה" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "עיר" }),
    ).toBeVisible();
    await expect(row.getByRole("cell", { name: CITY })).toBeVisible();

    // Act - לחיצה על תא רגיל (לא על כפתור) בשורה
    await row.getByRole("cell", { name: lastName, exact: true }).click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`/app/students/${studentId}$`), {
      timeout: 15_000,
    });
  });
});

test.describe("טבלת המיועדים - מובייל", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("מציגה כרטיסים ולא טבלה, עם אותם נתונים", async ({ page }) => {
    // Arrange
    await searchForTestStudent(page, true);
    const list = page.getByRole("list", { name: TABLE_CAPTION });
    const card = list.getByRole("group", { name: cardLabel });

    // Assert
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(card.getByText(`${FIRST_NAME} ${lastName}`)).toBeVisible();
    await expect(card.getByText(CITY)).toBeVisible();
    await expect(card.getByText(String(HEIGHT))).toBeVisible();
    await expect(card.getByRole("link", { name: "כרטיס מלא" })).toBeVisible();

    // Act - גם הכרטיס כולו פותח את הכרטיס המלא
    await card.getByText(CITY).click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`/app/students/${studentId}$`), {
      timeout: 15_000,
    });
  });
});
