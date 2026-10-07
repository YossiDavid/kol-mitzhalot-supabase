import { expect, test, type Locator, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

/**
 * לוח העבודה: שיבוץ מועדף במשבצת בלי גרירה. גרירה מהשורה השנייה והשלישית
 * של המועדפים לא עבדה כי המשבצות נשארו בראש העמוד, רחוק ממסך, והגרירה לא
 * גוללת בדרך. הפתרון: לחיצה כפולה, Enter/רווח על כרטיס בפוקוס וכפתור
 * "שיבוץ" - ובזמן גרירה המשבצות נדבקות לראש החלון.
 */
test.describe("לוח עבודה - שיבוץ בלי גרירה", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let userId: string;
  let previousFavorites: unknown;

  const maleSlot = (page: Page): Locator => page.locator("[data-male]");
  const femaleSlot = (page: Page): Locator => page.locator("[data-female]");

  /** כרטיס מועדף לפי השם (האזור עם aria-label שמתחיל בשם) */
  const favoriteCard = (page: Page, name: string): Locator =>
    page.getByRole("group", { name: new RegExp(`^${name}\\.`) });

  async function setFavorites(ids: string[]): Promise<void> {
    const { data } = await admin.auth.admin.getUserById(userId);
    const metadata = data.user?.user_metadata ?? {};
    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...metadata, favorites: ids },
    });
    if (error) throw new Error(`עדכון מועדפים נכשל: ${error.message}`);
  }

  test.beforeAll(async () => {
    admin = createServiceClient();
    userId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    const { data } = await admin.auth.admin.getUserById(userId);
    previousFavorites = data.user?.user_metadata?.favorites;
    await setFavorites([fx.groomFirst, fx.groomSecond, fx.brideFirst]);
  });

  test.afterAll(async () => {
    await setFavorites(
      Array.isArray(previousFavorites) ? (previousFavorites as string[]) : [],
    );
    await teardownShidduchFixtures(admin, fx);
  });

  test("לחיצה כפולה על כרטיס מיועד משבצת אותו במשבצת המיועד ומציגה לאן", async ({
    page,
  }) => {
    await page.goto("/app/canvas");

    await favoriteCard(page, "מיועד ראשון").dblclick();

    await expect(maleSlot(page)).toContainText("מיועד ראשון");
    await expect(femaleSlot(page)).not.toContainText("מיועד ראשון");
    await expect(
      page.getByText(/מיועד ראשון.*שובץ\/ה במשבצת המיועד/),
    ).toBeVisible();
  });

  test("כפתור שיבוץ בכרטיס מיועדת משבץ במשבצת המיועדת", async ({ page }) => {
    await page.goto("/app/canvas");
    await page.getByRole("tab", { name: "מיועדות" }).click();

    await page
      .getByRole("button", { name: /^שיבוץ .* במשבצת המיועדת$/ })
      .first()
      .click();

    await expect(femaleSlot(page)).toContainText("מיועדת ראשונה");
    await expect(page.getByText(/שובץ\/ה במשבצת המיועדת/)).toBeVisible();
  });

  test("Enter על כרטיס בפוקוס משבץ, ושיבוץ נוסף מחליף את מי שבמשבצת", async ({
    page,
  }) => {
    await page.goto("/app/canvas");

    await favoriteCard(page, "מיועד ראשון").focus();
    await page.keyboard.press("Enter");
    await expect(maleSlot(page)).toContainText("מיועד ראשון");

    await favoriteCard(page, "מיועד שני").focus();
    await page.keyboard.press("Space");
    await expect(maleSlot(page)).toContainText("מיועד שני");
    await expect(maleSlot(page)).not.toContainText("מיועד ראשון");
  });

  test("לחיצה כפולה על כפתור בתוך הכרטיס אינה משבצת", async ({ page }) => {
    await page.goto("/app/canvas");

    await page.getByRole("button", { name: /^שיבוץ מיועד ראשון/ }).dblclick();

    // שתי לחיצות על "שיבוץ" שיבצו פעמיים את אותו כרטיס, אבל לא יותר מזה
    await expect(maleSlot(page)).toContainText("מיועד ראשון");
  });
});
