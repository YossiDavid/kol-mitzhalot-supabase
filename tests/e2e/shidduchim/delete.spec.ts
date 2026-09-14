import { expect, request as apiRequest, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SEED,
  createServiceClient,
  deletePair,
  getShidduch,
  getTestUserId,
  insertShidduch,
} from "./fixtures";

const shidduchEndpoint = (id: string) => `/api/v1/shidduchim/${id}`;
const shidduchPageUrl = (id: string) => `/app/shidduchim/${id}`;

/**
 * מחיקת הצעה מותרת לשדכן שיצר אותה בלבד. ההרשאה נאכפת במדיניות ה-RLS
 * ("Users can delete their own shidduchim") ולא בבדיקה בקוד, ולכן חשוב לבדוק
 * את ההתנהגות דרך המסלול האמיתי ולא רק מול המסד.
 *
 * הצמד groomFirst + brideSecond שמור לבדיקות כאן, כדי שלא יתנגש עם הטיוטה
 * שבזרע ועם הצמדים של offer-pair.spec.ts.
 */
test.describe("מחיקת הצעת שידוך", () => {
  let admin: SupabaseClient;
  let testUserId: string;

  test.beforeAll(async () => {
    admin = createServiceClient();
    testUserId = await getTestUserId(admin);
  });

  /**
   * מנקים גם לפני וגם אחרי: בלי הניקוי המקדים הבדיקות מניחות שהצמד פנוי,
   * ושארית מהרצה שנקטעה מפילה אותן על unique_shidduch_pair במקום לבדוק
   * את מה שהן אמורות לבדוק.
   */
  const cleanPair = () => deletePair(admin, SEED.groomFirst, SEED.brideSecond);

  test.beforeEach(cleanPair);
  test.afterEach(cleanPair);

  test("השדכן מוחק הצעה שיצר — 200 והשורה נעלמת", async ({ request }) => {
    const id = await insertShidduch(admin, {
      groomId: SEED.groomFirst,
      brideId: SEED.brideSecond,
      shadchanId: testUserId,
    });

    const response = await request.delete(shidduchEndpoint(id));

    expect(response.status()).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(await getShidduch(admin, id)).toBeNull();
  });

  test("הצעה של שדכן אחר — 404, והשורה נשארת במקומה", async ({ request }) => {
    const response = await request.delete(
      shidduchEndpoint(SEED.existingDraftId),
    );

    // 404 ולא 403: אין לחשוף לזר שהצעה כזו בכלל קיימת
    expect(response.status()).toBe(404);

    const survivor = await getShidduch(admin, SEED.existingDraftId);
    expect(survivor).not.toBeNull();
    expect(survivor?.shadchan_id).toBe(SEED.shadchanUserId);
  });

  test("מזהה שאינו UUID — 400 לפני כל פנייה למסד", async ({ request }) => {
    const response = await request.delete(shidduchEndpoint("not-a-uuid"));

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("מזהה לא תקין");
  });

  test("בקשה ללא התחברות — 401, והשורה נשארת", async ({ baseURL }) => {
    const id = await insertShidduch(admin, {
      groomId: SEED.groomFirst,
      brideId: SEED.brideSecond,
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
      groomId: SEED.groomFirst,
      brideId: SEED.brideSecond,
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
