import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * שדות החיפוש המתקדם מסננים בפועל: טווח גובה (עמודת students.height)
 * ועיסוק (employment_history.category). לפני התיקון הם היו קישוט בלבד.
 */
const admin = createServiceClient();
const stamp = Date.now();
const LAST_NAME = `חיפוש${stamp}`;
const TALL = `גבוה${stamp}`;
const SHORT = `נמוך${stamp}`;

let studentIds: string[] = [];

async function createStudent(
  userId: string,
  firstName: string,
  height: number,
  employment: string,
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
      height,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`יצירת מיועד נכשלה: ${error?.message}`);

  const { error: empError } = await admin
    .from("employment_history")
    .insert({ student_id: data.id, category: employment });
  if (empError) throw new Error(`יצירת עיסוק נכשלה: ${empError.message}`);

  return data.id as string;
}

test.beforeAll(async () => {
  const userId = await getTestUserId(admin);
  studentIds = [
    await createStudent(userId, TALL, 185, "kolel"),
    await createStudent(userId, SHORT, 170, "working"),
  ];
});

test.afterAll(async () => {
  await admin.from("employment_history").delete().in("student_id", studentIds);
  await admin.from("students").delete().in("id", studentIds);
});

test("טווח גובה ועיסוק מצמצמים את התוצאות", async ({ page }) => {
  // Arrange
  await page.goto("/app/students");
  await page.locator("#search").fill(LAST_NAME);
  const tall = page.getByText(TALL).filter({ visible: true });
  const short = page.getByText(SHORT).filter({ visible: true });
  await expect(tall.first()).toBeVisible({ timeout: 10_000 });
  await expect(short.first()).toBeVisible();

  // Act - גובה מינימלי
  await page.getByRole("button", { name: "סינון מתקדם" }).click();
  await page.locator("#heightMin").fill("180");

  // Assert
  await expect(short).toHaveCount(0);
  await expect(tall.first()).toBeVisible();

  // Act - בלי גובה, רק עיסוק
  await page.locator("#heightMin").fill("");
  await page.locator("#employment").selectOption("working");

  // Assert
  await expect(tall).toHaveCount(0);
  await expect(short.first()).toBeVisible();
});
