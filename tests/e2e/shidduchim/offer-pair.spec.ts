import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SEED,
  countPairRows,
  createServiceClient,
  deletePair,
  getShidduch,
  getTestUserId,
  insertShidduch,
} from "./fixtures";

const OFFER_ENDPOINT = "/api/v1/shidduchim/offer";

/**
 * האילוץ unique_shidduch_pair מתיר שורה אחת בלבד לכל צמד. המסלול נתקל בשורה
 * קיימת בשלוש צורות, ולכל אחת התנהגות אחרת:
 *   טיוטה של שדכן אחר → סירוב, שורה שנדחתה → שימוש חוזר, טיוטה משלי → עדכון.
 *
 * הבדיקות רצות כמשתמש הבדיקה מ-auth.setup.ts, שהוא שדכן שאינו הבעלים של
 * הטיוטה שבזרע — וזה בדיוק ההבדל שמפעיל את הסירוב.
 */
test.describe("הצעת שידוך — טיפול בשורה קיימת לאותו צמד", () => {
  let admin: SupabaseClient;
  let testUserId: string;

  test.beforeAll(async () => {
    admin = createServiceClient();
    testUserId = await getTestUserId(admin);
  });

  /**
   * הצמדים שהבדיקות כאן מייצרות. הטיוטה שבזרע לא נמחקת.
   *
   * מנקים גם לפני וגם אחרי: בלי הניקוי המקדים הבדיקות מניחות שהצמד פנוי,
   * ושארית מהרצה שנקטעה מפילה אותן על unique_shidduch_pair במקום לבדוק
   * את מה שהן אמורות לבדוק.
   */
  const cleanPairs = async () => {
    await deletePair(admin, SEED.groomSecond, SEED.brideSecond);
    await deletePair(admin, SEED.groomSecond, SEED.brideFirst);
  };

  test.beforeEach(cleanPairs);
  test.afterEach(cleanPairs);

  test("טיוטה של שדכן אחר — סירוב ב-409, והטיוטה נשארת אצל הבעלים", async ({
    request,
  }) => {
    const response = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: SEED.groomFirst,
        brideId: SEED.brideFirst,
        action: "draft",
        noteForGroom: "ניסיון לדרוס טיוטה של שדכן אחר",
      },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("טיוטה של שדכן אחר");

    // הטיוטה המקורית לא נגעה — לא הבעלות, לא הסטטוס, ולא ההערה
    const original = await getShidduch(admin, SEED.existingDraftId);
    expect(original).not.toBeNull();
    expect(original?.shadchan_id).toBe(SEED.shadchanUserId);
    expect(original?.status).toBe("draft");
    expect(original?.note_for_groom).not.toContain("ניסיון לדרוס");

    expect(await countPairRows(admin, SEED.groomFirst, SEED.brideFirst)).toBe(
      1,
    );
  });

  test("שורה שנדחתה — שימוש חוזר באותה שורה, והבעלות עוברת לשדכן ששולח", async ({
    request,
  }) => {
    const rejectedId = await insertShidduch(admin, {
      groomId: SEED.groomSecond,
      brideId: SEED.brideSecond,
      shadchanId: SEED.shadchanUserId,
      status: "rejected",
    });

    const response = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: SEED.groomSecond,
        brideId: SEED.brideSecond,
        action: "draft",
        noteForGroom: "הצעה חדשה אחרי שהקודמת נדחתה",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // אותו מזהה = עדכון השורה הקיימת, ולא הכנסה שהייתה נשברת על האילוץ
    expect(body.id).toBe(rejectedId);
    expect(await countPairRows(admin, SEED.groomSecond, SEED.brideSecond)).toBe(
      1,
    );

    const reused = await getShidduch(admin, rejectedId);
    expect(reused?.status).toBe("draft");
    expect(reused?.shadchan_id).toBe(testUserId);
    expect(reused?.note_for_groom).toBe("הצעה חדשה אחרי שהקודמת נדחתה");
  });

  test("טיוטה משלי לאותו צמד — מתעדכנת ולא משוכפלת", async ({ request }) => {
    const first = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: SEED.groomSecond,
        brideId: SEED.brideFirst,
        action: "draft",
        noteForGroom: "נוסח ראשון",
      },
    });
    expect(first.status()).toBe(200);
    const firstId = (await first.json()).id;

    const second = await request.post(OFFER_ENDPOINT, {
      data: {
        groomId: SEED.groomSecond,
        brideId: SEED.brideFirst,
        action: "draft",
        noteForGroom: "נוסח מעודכן",
      },
    });
    expect(second.status()).toBe(200);
    expect((await second.json()).id).toBe(firstId);

    expect(await countPairRows(admin, SEED.groomSecond, SEED.brideFirst)).toBe(
      1,
    );

    const updated = await getShidduch(admin, firstId);
    expect(updated?.note_for_groom).toBe("נוסח מעודכן");
    expect(updated?.shadchan_id).toBe(testUserId);
  });
});
