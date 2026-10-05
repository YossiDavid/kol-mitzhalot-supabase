import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";
import { resetCardRules } from "../shidduchim/proposal-events";

/**
 * השהיית כרטיס ע"י הנהלה, מטבלת הילדים בעמוד פרטי המשתמש. ההשהיה מכבה את
 * in_shidduchim ונועלת אותו; ביטול ההשהיה מחזיר את הכרטיס לשידוכים.
 */
test.describe("השהיית כרטיס ע״י הנהלה", () => {
  let admin: SupabaseClient;
  let fx: ShidduchFixtures;

  test.beforeAll(async () => {
    admin = createServiceClient();
    fx = await setupShidduchFixtures(admin);
  });

  test.afterAll(async () => {
    await teardownShidduchFixtures(admin, fx);
  });

  test.beforeEach(async () => {
    await resetCardRules(admin, [fx.groomFirst]);
  });

  const readCard = async () => {
    const { data } = await admin
      .from("students")
      .select("in_shidduchim, admin_paused_at, admin_paused_by")
      .eq("id", fx.groomFirst)
      .single();
    return data;
  };

  test("השהיה ואז ביטול - המסד והממשק מתעדכנים", async ({ page }) => {
    // Arrange
    await page.goto(`/app/admin/users/${fx.cardManagerId}`);
    const badge = page
      .getByTestId(`admin-paused-badge-${fx.groomFirst}`)
      .first();
    await expect(badge).toHaveCount(0);

    // Act - השהיה
    await page
      .getByRole("button", { name: /השהיית כרטיס: מיועד ראשון/ })
      .click();

    // Assert
    await expect(badge).toBeVisible();
    const paused = await readCard();
    expect(paused?.in_shidduchim).toBe(false);
    expect(paused?.admin_paused_at).not.toBeNull();
    expect(paused?.admin_paused_by).not.toBeNull();

    // Act - ביטול
    await page
      .getByRole("button", { name: /ביטול השהיה: מיועד ראשון/ })
      .click();

    // Assert
    await expect(badge).toHaveCount(0);
    const resumed = await readCard();
    expect(resumed?.in_shidduchim).toBe(true);
    expect(resumed?.admin_paused_at).toBeNull();
  });

  test("ביטול השהיה לא מחזיר לשידוכים כרטיס מאורס", async ({ page }) => {
    // Arrange
    await admin
      .from("students")
      .update({
        personal_status: "engaged",
        admin_paused_at: new Date().toISOString(),
      })
      .eq("id", fx.groomFirst);
    await page.goto(`/app/admin/users/${fx.cardManagerId}`);

    // Act
    await page
      .getByRole("button", { name: /ביטול השהיה: מיועד ראשון/ })
      .click();
    await expect(
      page.getByTestId(`admin-paused-badge-${fx.groomFirst}`).first(),
    ).toHaveCount(0);

    // Assert
    const card = await readCard();
    expect(card?.admin_paused_at).toBeNull();
    expect(card?.in_shidduchim).toBe(false);

    await admin
      .from("students")
      .update({ personal_status: "single" })
      .eq("id", fx.groomFirst);
  });

  test("הנתיב סגור למי שאינו מנהל", async ({ playwright, baseURL }) => {
    // Arrange - בקשה בלי סשן; storageState ריק ומפורש, אחרת ההקשר יורש את
    // העוגיות של המנהל המחובר מהפרויקט
    const anonymous = await playwright.request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });

    // Act
    const response = await anonymous.patch(
      `/api/v1/students/${fx.groomFirst}/admin-pause`,
      { data: { paused: true } },
    );

    // Assert
    expect([401, 403]).toContain(response.status());
    expect((await readCard())?.admin_paused_at).toBeNull();
    await anonymous.dispose();
  });
});
