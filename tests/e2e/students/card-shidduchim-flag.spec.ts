import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * "מיועד לשידוכים" ירד מהפרטים האישיים: כרטיס פעיל הוא בשידוכים כברירת
 * מחדל, ולכן "כן" היה רעש. היוצא מן הכלל מסומן בהבלטה בראש הכרטיס,
 * והפעולות שמפנות אליו החוצה מושבתות.
 */
const FIELD_LABEL = "מיועד לשידוכים";
const BANNER = /אינו\/ה בשידוכים כרגע/;
const RUN_ID = Date.now();
const LAST_NAME = `שידוכים${RUN_ID}`;

const admin = createServiceClient();
let activeId: string;
let inactiveId: string;

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  const base = {
    user_id: userId,
    last_name: LAST_NAME,
    gender: "male",
    birth_date: "1998-01-01",
    personal_status: "single",
    country: "ישראל",
    city: "בני ברק",
  };

  const { data, error } = await admin
    .from("students")
    .insert([
      { ...base, first_name: "פעיל", in_shidduchim: true },
      { ...base, first_name: "מושהה", in_shidduchim: false },
    ])
    .select("id, in_shidduchim");
  if (error || !data) {
    throw new Error(`יצירת כרטיסי הבדיקה נכשלה: ${error?.message}`);
  }
  activeId = data.find((row) => row.in_shidduchim === true)?.id as string;
  inactiveId = data.find((row) => row.in_shidduchim === false)?.id as string;
});

test.afterAll(async () => {
  const ids = [activeId, inactiveId].filter(Boolean);
  if (ids.length > 0) await admin.from("students").delete().in("id", ids);
});

test("כרטיס פעיל: השדה ירד ואין הודעה", async ({ page }) => {
  // Arrange
  await page.goto(`/app/students/${activeId}`);
  await expect(page.locator("h1")).toContainText(LAST_NAME);

  // Assert
  await expect(page.getByText(FIELD_LABEL)).toHaveCount(0);
  await expect(page.getByText(BANNER)).toHaveCount(0);

  // Assert - הפעולות פתוחות
  await page.getByRole("button", { name: "עוד פעולות" }).click();
  await expect(
    page.getByRole("menuitem", { name: "שיתוף הכרטיס" }),
  ).not.toHaveAttribute("aria-disabled", "true");
});

test("כרטיס שהוצא משידוכים: הודעה בולטת ופעולות חסומות", async ({ page }) => {
  // Arrange
  await page.goto(`/app/students/${inactiveId}`);
  await expect(page.locator("h1")).toContainText(LAST_NAME);

  // Assert - ההודעה מחליפה את השדה, ולא מתווספת אליו
  await expect(page.getByText(BANNER)).toBeVisible();
  await expect(page.getByText(FIELD_LABEL)).toHaveCount(0);

  // Assert - השיתוף חסום, אבל העריכה ועדכון הסטטוס נשארים זמינים
  await expect(page.getByRole("link", { name: "עריכה" })).toBeVisible();
  await page.getByRole("button", { name: "עוד פעולות" }).click();
  await expect(
    page.getByRole("menuitem", { name: "שיתוף הכרטיס" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("menuitem", { name: "עדכון סטטוס" }),
  ).not.toHaveAttribute("aria-disabled", "true");
});
