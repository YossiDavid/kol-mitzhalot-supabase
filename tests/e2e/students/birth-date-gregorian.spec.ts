import { expect, test } from "@playwright/test";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";
import { insertCompleteCard } from "../helpers/complete-card";

/**
 * תאריך לידה: אפשר לעבור ללוח לועזי ולהקליד תאריך רגיל (לא כולם מכירים את
 * התאריך העברי). הערך נשמר כמו בבחירה מהלוח העברי.
 */
const SAVE_TIMEOUT_MS = 20_000;

test.describe("תאריך לידה לועזי", () => {
  const admin = createServiceClient();
  let studentId = "";

  test.beforeAll(async () => {
    studentId = await insertCompleteCard(admin, {
      userId: await getTestUserId(admin),
      firstName: "תאריך",
      lastName: `לועזי${Date.now()}`,
      extra: { birth_date: "1998-01-01" },
    });
  });

  test.afterAll(async () => {
    if (studentId) await admin.from("students").delete().eq("id", studentId);
  });

  test("מעבר ללועזי, הקלדת תאריך ושמירה", async ({ page }) => {
    // Arrange
    await page.goto(`/app/students/${studentId}/edit`);
    await page
      .getByRole("navigation", { name: "שלבי הטופס" })
      .getByRole("button", { name: "פרטים אישיים", exact: true })
      .click();
    const birthCell = page.locator('[data-field-name="birthDate"]');

    // Act
    await birthCell.getByRole("radio", { name: "לועזי" }).click();
    const dateInput = birthCell.locator('input[type="date"]');
    await expect(dateInput).toHaveValue("1998-01-01");
    await dateInput.fill("1999-03-15");
    await page
      .getByRole("button", { name: "שמירת שינויים", exact: true })
      .click();

    // Assert
    await expect(page.getByText("השינויים נשמרו בהצלחה!")).toBeVisible({
      timeout: SAVE_TIMEOUT_MS,
    });
    const { data } = await admin
      .from("students")
      .select("birth_date")
      .eq("id", studentId)
      .single();
    expect(data?.birth_date).toBe("1999-03-15");
  });
});
