import { expect, test } from "@playwright/test";
import {
  createClient as createAnonClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import {
  createServiceClient,
  deletePair,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";

const STATUS_ENDPOINT = "/api/v1/shidduchim/status";
const CLOSED_NOTICE_ENDPOINT = "/api/v1/shidduchim/closed-notice";
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";

/**
 * התראות בפעמון נכתבות בטריגרים סינכרוניים, ולכן אפשר לאמת אותן ישירות
 * אחרי הפעולה (בלי polling) - ע"י ספירת שורות לפני ואחרי.
 */
async function countNotifications(
  admin: SupabaseClient,
  userId: string,
  type: string,
): Promise<number> {
  const { count, error } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type);
  if (error) throw new Error(`ספירת התראות נכשלה: ${error.message}`);
  return count ?? 0;
}

async function markSent(
  admin: SupabaseClient,
  shidduchId: string,
  scope: "both" | "groom_only" | "bride_only",
): Promise<void> {
  const { error } = await admin
    .from("shidduchim")
    .update({
      status: "sent",
      recipient_scope: scope,
      sent_at: new Date().toISOString(),
    })
    .eq("id", shidduchId);
  if (error) throw new Error(`סימון הצעה כנשלחה נכשל: ${error.message}`);
}

async function markRejected(
  admin: SupabaseClient,
  shidduchId: string,
): Promise<void> {
  const { error } = await admin
    .from("shidduchim")
    .update({ status: "rejected" })
    .eq("id", shidduchId);
  if (error) throw new Error(`סימון הצעה כנדחתה נכשל: ${error.message}`);
}

test.describe("התראות — טריגרים ו-routes", () => {
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

  const cleanPair = () => deletePair(admin, fx.groomFirst, fx.brideFirst);
  test.beforeEach(cleanPair);
  test.afterEach(cleanPair);

  test("שדכן שהוא גם בעל הכרטיס לא מקבל התראת הצעה על ההצעה שלו", async () => {
    // Arrange: מנהל הכרטיסים הוא גם השדכן השולח
    const before = await countNotifications(
      admin,
      fx.cardManagerId,
      "shidduch_offer",
    );
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: fx.cardManagerId,
    });

    // Act
    await markSent(admin, id, "both");

    // Assert
    expect(
      await countNotifications(admin, fx.cardManagerId, "shidduch_offer"),
    ).toBe(before);
  });

  test("שליחה לצד אחד ואז לצד השני: כל צד מקבל התראה פעם אחת", async () => {
    // Arrange
    const before = await countNotifications(
      admin,
      fx.cardManagerId,
      "shidduch_offer",
    );
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: fx.otherShadchanId,
    });

    // Act + Assert: שליחה לצד המיועד בלבד
    await markSent(admin, id, "groom_only");
    expect(
      await countNotifications(admin, fx.cardManagerId, "shidduch_offer"),
    ).toBe(before + 1);

    // Act + Assert: send-other-side מעדכן sent_at ומרחיב ל-both
    await markSent(admin, id, "both");
    expect(
      await countNotifications(admin, fx.cardManagerId, "shidduch_offer"),
    ).toBe(before + 2);

    // Act + Assert: עדכון חוזר באותו היקף לא מכפיל
    await markSent(admin, id, "both");
    expect(
      await countNotifications(admin, fx.cardManagerId, "shidduch_offer"),
    ).toBe(before + 2);
  });

  test("שדכן שעורך סטטוס ידנית לא מקבל התראה על עצמו", async ({ request }) => {
    // Arrange
    const before = await countNotifications(
      admin,
      testUserId,
      "shidduch_response",
    );
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
      status: "sent",
    });

    // Act
    const response = await request.patch(STATUS_ENDPOINT, {
      data: { shidduchId: id, status: "rejected" },
    });

    // Assert
    expect(response.status()).toBe(200);
    expect((await response.json()).row.status).toBe("rejected");
    expect(
      await countNotifications(admin, testUserId, "shidduch_response"),
    ).toBe(before);
  });

  test("שינוי סטטוס שאינו של השדכן עצמו (בלי מבצע) כן מתריע לו", async () => {
    // Arrange
    const before = await countNotifications(
      admin,
      testUserId,
      "shidduch_response",
    );
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
      status: "sent",
    });

    // Act: כתיבה ישירה ב-service role, בלי set_shidduch_status_as
    const { error } = await admin
      .from("shidduchim")
      .update({ status: "rejected" })
      .eq("id", id);
    expect(error).toBeNull();

    // Assert
    expect(
      await countNotifications(admin, testUserId, "shidduch_response"),
    ).toBe(before + 1);
  });

  test("עדכון הצד השני: תיעוד, התראה לבעל הכרטיס, ושמירת ההודעה", async ({
    request,
  }) => {
    // Arrange: נשלח רק לצד המיועד, בבעלות מנהל הכרטיסים
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
    });
    await markSent(admin, id, "groom_only");
    await markRejected(admin, id);
    const before = await countNotifications(
      admin,
      fx.cardManagerId,
      "shidduch_closed_notice",
    );
    const message = "ההצעה אינה רלוונטית בשלב זה. בהצלחה רבה בהמשך הדרך.";

    // Act
    const response = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "groom", message },
    });

    // Assert
    expect(response.status()).toBe(200);
    expect(
      await countNotifications(
        admin,
        fx.cardManagerId,
        "shidduch_closed_notice",
      ),
    ).toBe(before + 1);

    const { data: notices } = await admin
      .from("shidduch_closed_notices")
      .select("side, message, sent_by, recipient_user_id")
      .eq("shidduch_id", id);
    expect(notices).toEqual([
      {
        side: "groom",
        message,
        sent_by: testUserId,
        recipient_user_id: fx.cardManagerId,
      },
    ]);
  });

  test("עדכון הצד השני: צד שההצעה לא נשלחה אליו נדחה ב-409", async ({
    request,
  }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
    });
    await markSent(admin, id, "groom_only");
    await markRejected(admin, id);

    const response = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "bride", message: "הודעה" },
    });

    expect(response.status()).toBe(409);
    const { count } = await admin
      .from("shidduch_closed_notices")
      .select("id", { count: "exact", head: true })
      .eq("shidduch_id", id);
    expect(count).toBe(0);
  });

  test("עדכון הצד השני: הודעה ריקה או ארוכה מדי נדחית ב-400", async ({
    request,
  }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
    });
    await markSent(admin, id, "both");

    const empty = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "groom", message: "   " },
    });
    const tooLong = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "groom", message: "א".repeat(501) },
    });

    expect(empty.status()).toBe(400);
    expect(tooLong.status()).toBe(400);
  });

  test("עדכון הצד השני: שדכן אחר לא יכול לעדכן הצעה של מישהו אחר", async ({
    request,
  }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: fx.otherShadchanId,
    });
    await markSent(admin, id, "both");

    const response = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "groom", message: "הודעה" },
    });

    expect(response.status()).toBe(403);
  });

  test("עדכון הצד השני: הצעה פעילה (לא נדחתה) נדחית ב-409", async ({
    request,
  }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
    });
    await markSent(admin, id, "both");

    const response = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "groom", message: "הודעה" },
    });

    expect(response.status()).toBe(409);
    const { count } = await admin
      .from("shidduch_closed_notices")
      .select("id", { count: "exact", head: true })
      .eq("shidduch_id", id);
    expect(count).toBe(0);
  });

  test("עדכון הצד השני: תגובת דחייה של צד מספיקה גם כשהסטטוס לא rejected", async ({
    request,
  }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
    });
    await markSent(admin, id, "both");
    const { error } = await admin.from("shidduch_responses").insert({
      shidduch_id: id,
      side: "bride",
      response: "rejected",
    });
    expect(error).toBeNull();

    const response = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "groom", message: "הודעה" },
    });

    expect(response.status()).toBe(200);
  });

  test("עדכון הצד השני: הודעה שנייה לאותו צד תוך 24 שעות נדחית ב-429", async ({
    request,
  }) => {
    const id = await insertShidduch(admin, {
      groomId: fx.groomFirst,
      brideId: fx.brideFirst,
      shadchanId: testUserId,
    });
    await markSent(admin, id, "both");
    await markRejected(admin, id);

    const first = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "groom", message: "הודעה ראשונה" },
    });
    const second = await request.post(CLOSED_NOTICE_ENDPOINT, {
      data: { shidduchId: id, side: "groom", message: "הודעה שנייה" },
    });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(429);
    const { count } = await admin
      .from("shidduch_closed_notices")
      .select("id", { count: "exact", head: true })
      .eq("shidduch_id", id);
    expect(count).toBe(1);
  });

  test("create_notification: לקוח אנונימי לא יכול לקרוא לה ישירות", async () => {
    // Arrange
    const anon = createAnonClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );

    // Act
    const { error } = await anon.rpc("create_notification", {
      p_user_id: testUserId,
      p_type: "shidduch_offer",
      p_title: "זיוף",
      p_body: null,
      p_link: "https://evil.example",
    });

    // Assert: ההרשאה נשללה, ולא נוצרה התראה
    expect(error).not.toBeNull();
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", testUserId)
      .eq("title", "זיוף");
    expect(count).toBe(0);
  });

  test("create_notification: קישור חיצוני או //host מדולג בשקט (service role)", async () => {
    // Act
    for (const link of ["https://evil.example", "//evil.example", "/\\evil"]) {
      const { error } = await admin.rpc("create_notification", {
        p_user_id: testUserId,
        p_type: "shidduch_offer",
        p_title: "קישור-לא-תקין",
        p_body: null,
        p_link: link,
      });
      expect(error).toBeNull();
    }
    const { error: okError } = await admin.rpc("create_notification", {
      p_user_id: testUserId,
      p_type: "shidduch_offer",
      p_title: "קישור-לא-תקין",
      p_body: null,
      p_link: "/app/proposals",
    });
    expect(okError).toBeNull();

    // Assert: רק הקישור הפנימי נשמר
    const { data } = await admin
      .from("notifications")
      .select("link")
      .eq("user_id", testUserId)
      .eq("title", "קישור-לא-תקין");
    expect(data).toEqual([{ link: "/app/proposals" }]);
    await admin
      .from("notifications")
      .delete()
      .eq("user_id", testUserId)
      .eq("title", "קישור-לא-תקין");
  });

  test("הרשמה חדשה: מנהל מקבל התראה, ונוצר סימון מייל ממתין", async () => {
    // Arrange: דורש את משתמש המנהל של setup-admin
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const adminUser = users?.users.find((u) => u.email === ADMIN_EMAIL);
    test.skip(!adminUser, "משתמש המנהל של הבדיקות לא קיים - setup-admin לא רץ");

    const email = `playwright-signup-${Date.now()}@kol-mitzhalot.test`;

    // Act
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      phone: `+9725${Date.now().toString().slice(-8)}`,
      email_confirm: true,
      user_metadata: {
        firstName: "נרשם",
        lastName: "חדש",
        phone: "+972500000099",
      },
    });
    expect(error).toBeNull();
    const newUserId = created.user!.id;

    try {
      // Assert: התראה למנהל עם קישור לכרטיס המשתמש
      const { data: notifications } = await admin
        .from("notifications")
        .select("title, body, link, related_id")
        .eq("user_id", adminUser!.id)
        .eq("type", "user_registered")
        .eq("related_id", newUserId);
      expect(notifications).toHaveLength(1);
      expect(notifications![0].link).toBe(`/app/admin/users/${newUserId}`);
      expect(notifications![0].body).toContain(email);

      // Assert: סימון ממתין (sent_at ריק) - הבסיס לאידמפוטנטיות המייל
      const { data: marker } = await admin
        .from("signup_admin_notifications")
        .select("sent_at, claimed_at")
        .eq("user_id", newUserId)
        .single();
      expect(marker).toEqual({ sent_at: null, claimed_at: null });
    } finally {
      await admin.auth.admin.deleteUser(newUserId);
    }
  });
});
