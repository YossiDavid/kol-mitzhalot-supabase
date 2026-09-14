import { expect, request as apiRequest, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  deletePair,
  getShidduch,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

const shidduchEndpoint = (id: string) => `/api/v1/shidduchim/${id}`;
const shidduchPageUrl = (id: string) => `/app/shidduchim/${id}`;

/**
 * מחיקת הצעה מותרת לשדכן שיצר אותה בלבד. ההרשאה נאכפת במדיניות ה-RLS
 * ("Users can delete their own shidduchim") ולא בבדיקה בקוד, ולכן חשוב לבדוק
 * את ההתנהגות דרך המסלול האמיתי ולא רק מול המסד.
 *
 * הבדיקות מקימות לעצמן מיועדים ומשתמשים ואינן נשענות על supabase/seed.sql,
 * שרץ רק על המסד המקומי — כך הן עובדות גם מול מסד בדיקות נקי ב-CI.
 */
test.describe("מחיקת הצעת שידוך", () => {
  let admin: SupabaseClient;
  let testUserId: string;
  let fx: ShidduchFixtures;

  test.beforeAll(async () => {
    admin = createServiceClient();
    testUserId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
  });

  test.afterAll(async () => {
    await teardownShidduchFixtures(admin, fx);
  });

  /**
   * מנקים גם לפני וגם אחרי: בלי הניקוי המקדים הבדיקות מניחות שהצמד פנוי,
   * ושארית מהרצה שנקטעה מפילה אותן על unique_shidduch_pair במקום לבדוק
   * את מה שהן אמורות לבדוק.
   */
  const cleanPairs = async () => {
    await deletePair(admin, fx.groomFirst, fx.brideSecond);
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
  };

  test.beforeEach(cleanPairs);
  test.afterEach(cleanPairs);

  test("השדכן מוחק הצעה שיצר — 200 והשורה נעלמת", async ({ request }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideSecond,
      shadchanId: testUserId,
    });

    const response = await request.delete(shidduchEndpoint(id));

    expect(response.status()).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(await getShidduch(admin, id)).toBeNull();
  });

  test("הצעה של שדכן אחר — 404, והשורה נשארת במקומה", async ({ request }) => {
    const othersId = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: fx.otherShadchanId,
    });

    const response = await request.delete(shidduchEndpoint(othersId));

    // 404 ולא 403: אין לחשוף לזר שהצעה כזו בכלל קיימת
    expect(response.status()).toBe(404);

    const survivor = await getShidduch(admin, othersId);
    expect(survivor).not.toBeNull();
    expect(survivor?.shadchan_id).toBe(fx.otherShadchanId);
  });

  test("מזהה שאינו UUID — 400 לפני כל פנייה למסד", async ({ request }) => {
    const response = await request.delete(shidduchEndpoint("not-a-uuid"));

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("מזהה לא תקין");
  });

  test("בקשה ללא התחברות — 401, והשורה נשארת", async ({ baseURL }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideSecond,
      shadchanId: testUserId,
    });

    // storageState ריק ומפורש: בלי זה ההקשר יורש את העוגיות של המשתמש
    // המחובר, המחיקה מצליחה, והבדיקה מוכיחה את ההפך ממטרתה
    const anonymous = await apiRequest.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await anonymous.delete(shidduchEndpoint(id));
      expect(response.status()).toBe(401);
    } finally {
      await anonymous.dispose();
    }

    expect(await getShidduch(admin, id)).not.toBeNull();
  });

  test("כפתור המחיקה בכרטיס — מוחק בפועל ומנווט לרשימת ההצעות", async ({
    page,
  }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideSecond,
      shadchanId: testUserId,
      noteForGroom: "הצעה שנוצרה לבדיקת המחיקה",
    });

    await page.goto(shidduchPageUrl(id));

    const trigger = page.getByRole("button", { name: "מחיקת ההצעה" });
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("מחיקת הצעת שידוך")).toBeVisible();

    await dialog.getByRole("button", { name: "מחיקת ההצעה" }).click();

    await expect(page).toHaveURL(/\/app\/shadchan\/proposals/, {
      timeout: 15_000,
    });
    expect(await getShidduch(admin, id)).toBeNull();
  });
});
