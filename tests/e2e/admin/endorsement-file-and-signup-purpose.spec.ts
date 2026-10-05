import { expect, test } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

/**
 * ניהול: צפייה בקובץ ההסכמה בגודל מלא, ועמודת "מטרת ההרשמה" ברשימת
 * המשתמשים ובפרטי המשתמש.
 */
test.describe("ניהול — קובץ הסכמה ומטרת הרשמה", () => {
  const RAV_NAME = `רב בדיקה ${Date.now()}`;
  const IMAGE_URL = "https://example.com/endorsement-e2e.png";
  let endorsementId: string | null = null;

  test.afterAll(async () => {
    if (!endorsementId) return;
    await createServiceClient()
      .from("endorsements")
      .delete()
      .eq("id", endorsementId);
  });

  test("בשורת ההסכמה יש קישור 'צפייה בקובץ' שנפתח בלשונית חדשה", async ({
    page,
  }) => {
    // Arrange
    const { data, error } = await createServiceClient()
      .from("endorsements")
      .insert({
        rav_name: RAV_NAME,
        image_url: IMAGE_URL,
        is_published: false,
        sort_order: 0,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    endorsementId = data?.id ?? null;

    // Act
    await page.goto("/app/admin/content/endorsements");
    const link = page
      .locator("div", { hasText: RAV_NAME })
      .getByRole("link", { name: "צפייה בקובץ" })
      .first();

    // Assert
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", IMAGE_URL);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("רשימת המשתמשים מציגה עמודת 'מטרת ההרשמה'", async ({ page }) => {
    // Act
    await page.goto("/app/admin/users");

    // Assert
    await expect(
      page.getByRole("columnheader", { name: "מטרת ההרשמה" }),
    ).toBeVisible();
  });

  test("פרטי משתמש מציגים 'מטרת ההרשמה' (מקף כשחסרה)", async ({ page }) => {
    // Arrange
    await page.goto("/app/admin/users");

    // Act
    await page
      .getByRole("table")
      .getByRole("link", { name: "צפייה" })
      .first()
      .click();

    // Assert
    // ברשימה (תצוגת הכרטיסים) יש גם תוויות "מטרת ההרשמה:", לכן ממתינים
    // שעמוד הפרטים עצמו יוצג לפני הבדיקה.
    await expect(
      page.getByRole("heading", { name: "מידע בסיסי" }),
    ).toBeVisible();
    // מוצג בשורה אחת עם הערך; מקף כשהמשתמש נוצר בלי מטרת הרשמה.
    await expect(page.getByText(/^מטרת ההרשמה:\s+\S/)).toBeVisible();
  });
});
