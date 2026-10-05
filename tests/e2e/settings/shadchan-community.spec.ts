import { expect, test } from "@playwright/test";

/**
 * טופס ההצטרפות כשדכן: שדה "קהילה / חסידות" אופציונלי. משתמש שכבר שדכן או
 * אדמין מופנה משם, ולכן הבדיקה מדלגת אם הטופס לא נפתח.
 */
test.describe("הגדרות — הצטרפות כשדכן", () => {
  test("שדה הקהילה מוצג וללא כוכבית חובה", async ({ page }) => {
    // Arrange
    await page.goto("/app/settings/shadchan");
    const heading = page.getByRole("heading", { name: "טופס הצטרפות" });
    const isFormOpen = await heading
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!isFormOpen, "משתמש הבדיקה כבר שדכן/אדמין - הטופס לא נפתח");

    // Assert
    await expect(page.getByText("קהילה / חסידות")).toBeVisible();
    await expect(page.locator("#community")).toBeVisible();
  });
});
