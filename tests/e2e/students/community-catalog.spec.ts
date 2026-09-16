import { test, expect } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * "חסידות או קהילה" הוא בורר מתוך מאגר הקהילות: ערכי ברירת המחדל מוצעים,
 * וערך שאינו במאגר מוצע להוספה, נוסף לטבלה ונבחר בשדה.
 */
const DEFAULT_COMMUNITY = "בעלזא";
const NEW_COMMUNITY = `קהילת בדיקה ${Date.now()}`;

const admin = createServiceClient();

test.afterAll(async () => {
  await admin.from("communities").delete().eq("name", NEW_COMMUNITY);
});

async function openCommunityField(page: import("@playwright/test").Page) {
  await page.goto("/app/students/create");
  await page.getByRole("radio", { name: "מיועד", exact: true }).check();
  await page.getByRole("button", { name: "המשך לשלב הבא" }).click();
  const cell = page.locator('[data-field-name="community"]');
  await expect(cell).toBeVisible();
  await cell.getByRole("combobox").click();
  return cell;
}

test.describe("מאגר החסידויות והקהילות", () => {
  test("ערכי ברירת המחדל מוצעים בבורר", async ({ page }) => {
    // Arrange + Act
    await openCommunityField(page);

    // Assert
    const listbox = page.getByRole("listbox");
    for (const name of [DEFAULT_COMMUNITY, "צאנז", "קרלין", "ויז׳ניץ"]) {
      await expect(listbox.getByRole("option", { name })).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test("ערך שאינו במאגר מוצע להוספה, נשמר ונבחר", async ({ page }) => {
    // Arrange
    const cell = await openCommunityField(page);

    // Act
    await page.getByPlaceholder("חיפוש...").fill(NEW_COMMUNITY);
    const createOption = page.getByRole("option", {
      name: new RegExp(`הוספה למאגר.*${NEW_COMMUNITY}`),
    });
    await expect(createOption).toBeVisible({ timeout: 10_000 });
    await createOption.click();

    // Assert - נבחר בשדה
    await expect(cell.getByRole("combobox")).toHaveText(NEW_COMMUNITY, {
      timeout: 10_000,
    });

    // Assert - נשמר במאגר
    const { data } = await admin
      .from("communities")
      .select("name, is_active")
      .eq("name", NEW_COMMUNITY)
      .maybeSingle();
    expect(data?.name).toBe(NEW_COMMUNITY);
    expect(data?.is_active).toBe(true);
  });
});
