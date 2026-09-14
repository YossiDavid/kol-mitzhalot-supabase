import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  countPairRows,
  createServiceClient,
  deletePair,
  getShidduch,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";

const OFFER_ENDPOINT = "/api/v1/shidduchim/offer";

/**
 * האילוץ unique_shidduch_pair מתיר שורה אחת בלבד לכל צמד. המסלול נתקל בשורה
 * קיימת בשלוש צורות, ולכל אחת התנהגות אחרת:
 *   טיוטה של שדכן אחר → סירוב, שורה שנדחתה → שימוש חוזר, טיוטה משלי → עדכון.
 *
 * הבדיקות מקימות לעצמן מיועדים ומשתמשים ואינן נשענות על supabase/seed.sql,
 * שרץ רק על המסד המקומי — כך הן עובדות גם מול מסד בדיקות נקי ב-CI.
 */
test.describe("הצעת שידוך — טיפול בשורה קיימת לאותו צמד", () => {
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
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await deletePair(admin, fx.groomSecond, fx.brideSecond);
    await deletePair(admin, fx.groomSecond, fx.brideFirst);
  };

  test.beforeEach(cleanPairs);
  test.afterEach(cleanPairs);

  test("טיוטה של שדכן אחר — סירוב ב-409, והטיוטה נשארת אצל הבעלים", async ({
    request,
  }) => {
    const othersDraftId = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: fx.otherShadchanId,
      noteForGroom: "הטיוטה של השדכן האחר",
    });

    const response = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        action: "draft",
        noteForGroom: "ניסיון לדרוס טיוטה של שדכן אחר",
      },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("טיוטה של שדכן אחר");

    // הטיוטה המקורית לא נגעה — לא הבעלות, לא הסטטוס, ולא ההערה
    const original = await getShidduch(admin, othersDraftId);
    expect(original).not.toBeNull();
    expect(original?.shadchan_id).toBe(fx.otherShadchanId);
    expect(original?.status).toBe("draft");
    expect(original?.note_for_groom).toBe("הטיוטה של השדכן האחר");

    expect(await countPairRows(admin, fx.groomFirst, fx.brideFirst)).toBe(1);
  });

  test("שורה שנדחתה — שימוש חוזר באותה שורה, והבעלות עוברת לשדכן ששולח", async ({
    request,
  }) => {
    const rejectedId = await insertShidduch(admin, {
      groomId: fx.groomSecond,
      brideId: fx.brideSecond,
      shadchanId: fx.otherShadchanId,
      status: "rejected",
    });

    const response = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: fx.groomSecond,
        brideId: fx.brideSecond,
        action: "draft",
        noteForGroom: "הצעה חדשה אחרי שהקודמת נדחתה",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // אותו מזהה = עדכון השורה הקיימת, ולא הכנסה שהייתה נשברת על האילוץ
    expect(body.id).toBe(rejectedId);
    expect(await countPairRows(admin, fx.groomSecond, fx.brideSecond)).toBe(1);

    const reused = await getShidduch(admin, rejectedId);
    expect(reused?.status).toBe("draft");
    expect(reused?.shadchan_id).toBe(testUserId);
    expect(reused?.note_for_groom).toBe("הצעה חדשה אחרי שהקודמת נדחתה");
  });

  test("טיוטה משלי לאותו צמד — מתעדכנת ולא משוכפלת", async ({ request }) => {
    const first = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: fx.groomSecond,
        brideId: fx.brideFirst,
        action: "draft",
        noteForGroom: "נוסח ראשון",
      },
    });
    expect(first.status()).toBe(200);
    const firstId = (await first.json()).id;

    const second = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: fx.groomSecond,
        brideId: fx.brideFirst,
        action: "draft",
        noteForGroom: "נוסח מעודכן",
      },
    });
    expect(second.status()).toBe(200);
    expect((await second.json()).id).toBe(firstId);

    expect(await countPairRows(admin, fx.groomSecond, fx.brideFirst)).toBe(1);

    const updated = await getShidduch(admin, firstId);
    expect(updated?.note_for_groom).toBe("נוסח מעודכן");
    expect(updated?.shadchan_id).toBe(testUserId);
  });
});
