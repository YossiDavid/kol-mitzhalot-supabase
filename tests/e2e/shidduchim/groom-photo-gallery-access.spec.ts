import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { CARD_MANAGER_EMAIL, pageAs } from "../chats/context-fixtures";
import {
  createServiceClient,
  deletePair,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";
import { clearEvents, resetCardRules } from "./proposal-events";

/**
 * גלריית תמונות של בחור מול הורה בצד הכלה. כשהשדכן לא שיתף תמונה
 * (share_groom_photo=false) ה-API לא מחזיר אף קישור חתום; כשהשיתוף דלוק -
 * מחזיר. הבדיקה מכסה את נתיב הגלריה (GET /api/v1/students/:id/photos), שבעבר
 * דילג על הכרעת ה-DB לכל כרטיס של בן.
 */

const BUCKET = "students";
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("גלריית תמונות בחור - צד הכלה", () => {
  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let photoPath: string;

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);

    // מנהל הכרטיסים הוא בעל שני הכרטיסים - הבחור עובר לבעלים אחר, כך
    // שמנהל הכרטיסים הוא "הורה בצד הכלה" בלבד
    await admin
      .from("students")
      .update({ user_id: fx.otherShadchanId })
      .eq("id", fx.groomFirst);

    photoPath = `${fx.groomFirst}/photos/gallery-access.png`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(photoPath, TINY_PNG, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`העלאת תמונה: ${uploadError.message}`);
    const { error: photoError } = await admin
      .from("student_photos")
      .insert({
        student_id: fx.groomFirst,
        storage_path: photoPath,
        position: 0,
      });
    if (photoError) throw new Error(`שורת תמונה: ${photoError.message}`);
  });

  test.afterAll(async () => {
    await admin.storage.from(BUCKET).remove([photoPath]);
    await admin.from("student_photos").delete().eq("student_id", fx.groomFirst);
    await admin
      .from("students")
      .update({ user_id: fx.cardManagerId })
      .eq("id", fx.groomFirst);
    await teardownShidduchFixtures(admin, fx);
  });

  test.afterEach(async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await clearEvents(admin, [fx.groomFirst, fx.brideFirst]);
    await resetCardRules(admin, [fx.groomFirst, fx.brideFirst]);
  });

  const sendProposal = async (shareGroomPhoto: boolean) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId,
    });
    const { error } = await admin
      .from("shidduchim")
      .update({
        status: "sent",
        recipient_scope: "both",
        sent_at: new Date().toISOString(),
        share_groom_photo: shareGroomPhoto,
      })
      .eq("id", id);
    expect(error).toBeNull();
  };

  const fetchGallery = async (browser: import("@playwright/test").Browser) => {
    const page = await pageAs(browser, admin, CARD_MANAGER_EMAIL, "/app");
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    const response = await page.request.get(
      `${base}/api/v1/students/${fx.groomFirst}/photos`,
    );
    const body = (await response.json()) as {
      photos?: { url: string }[];
      error?: string;
    };
    await page.context().close();
    return { status: response.status(), body };
  };

  test("שיתוף תמונה כבוי - הגלריה נחסמת ולא נחתם אף קישור", async ({
    browser,
  }) => {
    test.setTimeout(90_000);

    // Arrange
    await sendProposal(false);

    // Act
    const { status, body } = await fetchGallery(browser);

    // Assert
    expect(status).toBe(403);
    expect(body.photos).toBeUndefined();
  });

  test("שיתוף תמונה דלוק - הגלריה מחזירה את התמונה", async ({ browser }) => {
    test.setTimeout(90_000);

    // Arrange
    await sendProposal(true);

    // Act
    const { status, body } = await fetchGallery(browser);

    // Assert
    expect(status).toBe(200);
    expect(body.photos?.length).toBe(1);
  });
});
