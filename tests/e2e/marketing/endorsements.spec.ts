/**
 * Callers: Playwright `marketing` project.
 * API: home #endorsements carousel + /endorsements ← endorsements (public RLS).
 * User: "הוספתי תמונות רבנים כהמלצות ולא רואים אותן, רק 3 רואים".
 */
import { expect, test } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

const RUN_ID = Date.now();
const EXTRA_COUNT = 5;
const PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test.describe("הסכמות רבנים", () => {
  const ids: string[] = [];
  const names = Array.from(
    { length: EXTRA_COUNT },
    (_, index) => `רב בדיקה ${RUN_ID} מספר ${index + 1}`,
  );

  test.beforeAll(async () => {
    const { data, error } = await createServiceClient()
      .from("endorsements")
      .insert(
        names.map((name, index) => ({
          rav_name: name,
          rav_title: "רב הקהילה",
          image_url: index % 2 === 0 ? PIXEL_PNG : null,
          endorsement_text: "מברך על המערכת",
          sort_order: 900 + index,
          is_published: true,
        })),
      )
      .select("id");
    expect(error).toBeNull();
    ids.push(...(data ?? []).map((row) => row.id as string));
  });

  test.afterAll(async () => {
    if (ids.length === 0) return;
    await createServiceClient().from("endorsements").delete().in("id", ids);
  });

  test("עמוד /endorsements מציג את כל ההסכמות שפורסמו, לא רק שלוש", async ({
    page,
  }) => {
    // Act
    await page.goto("/endorsements");

    // Assert
    for (const name of names) {
      await expect(page.getByRole("heading", { level: 3, name })).toBeVisible();
    }
    expect(
      await page.getByRole("heading", { level: 3 }).count(),
    ).toBeGreaterThan(3);
  });

  test("לחיצה על תמונת הסכמה פותחת אותה בגודל מלא", async ({ page }) => {
    // Arrange
    await page.goto("/endorsements");

    // Act
    await page
      .getByRole("button", { name: `הגדלת ההסכמה של ${names[0]}` })
      .click();

    // Assert
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(names[0])).toBeVisible();
  });

  test("הקרוסלה בדף הבית: חצים, מונה 'מתוך' וקישור לכל ההסכמות", async ({
    page,
  }) => {
    // Act
    await page.goto("/");
    const section = page.locator("#endorsements");
    await section.scrollIntoViewIfNeeded();

    // Assert
    await expect(
      section.getByRole("button", { name: "ההסכמה הבאה" }),
    ).toBeVisible();
    await expect(
      section.getByRole("button", { name: "ההסכמה הקודמת" }),
    ).toBeVisible();
    await expect(section.getByText(/\d+ מתוך \d+/)).toBeVisible();
    await expect(
      section.getByRole("link", { name: /לכל ההסכמות \(\d+\)/ }),
    ).toBeVisible();
  });

  test("לחיצה על 'הבא' מקדמת את המונה", async ({ page }) => {
    // Arrange
    await page.goto("/");
    const section = page.locator("#endorsements");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByText(/^1 מתוך/)).toBeVisible();

    // Act — מפסיקים גלילה אוטומטית כדי שלא תתערב בספירה
    await section
      .getByRole("button", { name: "השהיית הגלילה האוטומטית" })
      .click();
    await section.getByRole("button", { name: "ההסכמה הבאה" }).click();

    // Assert
    await expect(section.getByText(/^2 מתוך/)).toBeVisible();
  });

  test("עם prefers-reduced-motion אין גלילה אוטומטית ואין כפתור השהיה", async ({
    browser,
  }) => {
    // Arrange
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();

    // Act
    await page.goto("/");
    const section = page.locator("#endorsements");
    await section.scrollIntoViewIfNeeded();

    // Assert
    await expect(section.getByText(/^1 מתוך/)).toBeVisible();
    await expect(
      section.getByRole("button", { name: /הגלילה האוטומטית/ }),
    ).toHaveCount(0);
    await context.close();
  });

  test("קישור 'הסכמות והמלצות' בהדר מוביל לעמוד ההסכמות", async ({ page }) => {
    // Arrange
    await page.goto("/about");

    // Act
    await page
      .locator("header")
      .first()
      .getByRole("link", { name: "הסכמות והמלצות" })
      .click();

    // Assert
    await expect(page).toHaveURL(/\/endorsements$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "הסכמות",
    );
  });
});
