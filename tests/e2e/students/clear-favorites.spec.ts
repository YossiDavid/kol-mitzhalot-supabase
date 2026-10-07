import { test, expect } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";
import { clearFavoritesMessage } from "../../../features/students/lib/clear-favorites";

/**
 * "ניקוי כל המועדפים": הכפתור מופיע רק כשיש מועדפים, הדיאלוג מציין כמה
 * יוסרו, ואחרי האישור הרשימה מתרוקנת ונשמרת כך גם אחרי רענון.
 */
const LOAD_TIMEOUT = 15_000;
const FAVORITES_COUNT = 2;

const admin = createServiceClient();
let userId = "";
let studentIds: string[] = [];
let previousFavorites: unknown = [];

async function setFavorites(favorites: string[]) {
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: { favorites },
  });
  if (error) throw new Error(`עדכון המועדפים נכשל: ${error.message}`);
}

test.beforeAll(async () => {
  userId = await getTestUserId(admin);
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  previousFavorites = userData.user?.user_metadata?.favorites ?? [];

  const token = `${Date.now()}`;
  const { data, error } = await admin
    .from("students")
    .insert(
      Array.from({ length: FAVORITES_COUNT }, (_, index) => ({
        user_id: userId,
        first_name: "מועדף",
        last_name: `ניקוי${token}${index}`,
        birth_date: "1999-01-01",
        gender: index % 2 === 0 ? "male" : "female",
        personal_status: "single",
        country: "ישראל",
        city: "בני ברק",
        in_shidduchim: true,
      })),
    )
    .select("id");
  if (error || !data) throw new Error(`יצירת כרטיסים נכשלה: ${error?.message}`);
  studentIds = data.map((row) => row.id as string);
});

test.afterAll(async () => {
  await setFavorites(Array.isArray(previousFavorites) ? previousFavorites : []);
  if (studentIds.length > 0) {
    await admin.from("students").delete().in("id", studentIds);
  }
});

test("ניסוח הדיאלוג מציין כמה מועדפים יוסרו", () => {
  expect(clearFavoritesMessage(1)).toContain("אחד/ת");
  expect(clearFavoritesMessage(5)).toContain("5 מיועדים");
});

test("בדשבורד: ניקוי עם אישור מרוקן את המועדפים, וביטול משאיר אותם", async ({
  page,
}) => {
  // Arrange
  await setFavorites(studentIds);
  await page.goto("/app");
  const clearButton = page.getByTestId("clear-favorites");
  await expect(clearButton).toBeVisible({ timeout: LOAD_TIMEOUT });

  // Act - ביטול
  await clearButton.click();
  const dialog = page.getByRole("dialog", { name: "ניקוי כל המועדפים" });
  await expect(dialog).toContainText(`${FAVORITES_COUNT} מיועדים`);
  await dialog.getByRole("button", { name: "ביטול" }).click();

  // Assert
  await expect(dialog).toBeHidden();
  await expect(clearButton).toBeVisible();

  // Act - אישור
  await clearButton.click();
  await page.getByRole("button", { name: "ניקוי המועדפים" }).click();

  // Assert - הכפתור נעלם מיד ומצב ריק מוצג
  await expect(clearButton).toBeHidden({ timeout: LOAD_TIMEOUT });
  await expect(
    page.getByText("עוד לא הוספת שמות מועדפים ללוח העבודה"),
  ).toBeVisible();

  // Assert - נשמר גם אחרי רענון
  await page.reload();
  await expect(
    page.getByText("עוד לא הוספת שמות מועדפים ללוח העבודה"),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(page.getByTestId("clear-favorites")).toHaveCount(0);
});
