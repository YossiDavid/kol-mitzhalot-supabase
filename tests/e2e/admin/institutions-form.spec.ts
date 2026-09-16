import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * טופס המוסד בעמוד ניהול המוסדות, אחרי המעבר ל-react-hook-form + zod
 * (docs/design-refactor/PLAN.md, שלב 3). לפני השלב הזה הדיאלוג החזיק את
 * השדות ב-useState והציג שגיאת חובה כ-toast, בלי סימון השדה עצמו.
 *
 * הבדיקה יוצרת מוסד בשם ייחודי ומוחקת אותו ב-afterAll.
 */
test.describe("ניהול מוסדות — טופס מוסד", () => {
  let admin: SupabaseClient;
  const institutionName = `בדיקת מוסד ${Date.now()}`;

  test.beforeAll(() => {
    admin = createServiceClient();
  });

  test.afterAll(async () => {
    const { error } = await admin
      .from("institutions")
      .delete()
      .eq("name", institutionName);
    if (error) {
      throw new Error(`ניקוי מוסד הבדיקה נכשל: ${error.message}`);
    }
  });

  test("שם מוסד ריק נחסם עם הודעה מתחת לשדה", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/institutions");
    await page.getByRole("button", { name: "מוסד חדש" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("מוסד חדש")).toBeVisible();

    // Act
    await dialog.getByRole("button", { name: "שמירה" }).click();

    // Assert - הדיאלוג נשאר פתוח והשגיאה ליד השדה
    await expect(dialog.getByText("נא למלא שם המוסד")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("מוסד חדש נשמר ומופיע בטבלה", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/institutions");
    await page.getByRole("button", { name: "מוסד חדש" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("שם המוסד")).toBeVisible();

    // Act
    await dialog.getByLabel("שם המוסד").fill(institutionName);
    await dialog.getByLabel("עיר").fill("בני ברק");
    await dialog.getByRole("button", { name: "שמירה" }).click();

    // Assert
    await expect(page.getByText("המוסד נוצר בהצלחה")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole("table").getByText(institutionName),
    ).toBeVisible({ timeout: 15_000 });

    const { data } = await admin
      .from("institutions")
      .select("name, city, is_active")
      .eq("name", institutionName)
      .single();
    expect(data?.city).toBe("בני ברק");
    expect(data?.is_active).toBe(true);
  });
});
