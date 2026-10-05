import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  deletePair,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";
import {
  clearEvents,
  daysAgo,
  hoursAgo,
  listEvents,
  resetCardRules,
  seedEvent,
  simulateSend,
} from "./proposal-events";

const OFFER_ENDPOINT = "/api/v1/shidduchim/offer";
const SEND_OTHER_SIDE_ENDPOINT = "/api/v1/shidduchim/send-other-side";

/**
 * יומן ההצעות (shidduch_events), מכסת ההצעות של הכרטיס וההשהיה.
 *
 * הבדיקות של היומן כותבות ל-shidduchim ישירות, באותם שני שלבים ש-offer/route.ts
 * מבצע - כך אין תלות בשליחת מייל. סירובי ה-route נבדקים דרך ה-API, והם
 * מתרחשים לפני שליחת המייל ולכן לא שולחים דבר.
 */
test.describe("יומן הצעות, מכסה והשהיה", () => {
  let admin: SupabaseClient;
  let testUserId: string;
  let fx: ShidduchFixtures;
  let cardIds: string[];

  test.beforeAll(async () => {
    admin = createServiceClient();
    testUserId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    cardIds = [fx.groomFirst, fx.groomSecond, fx.brideFirst, fx.brideSecond];
  });

  test.afterAll(async () => {
    await clearEvents(admin, cardIds);
    await teardownShidduchFixtures(admin, fx);
  });

  const reset = async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await deletePair(admin, fx.groomFirst, fx.brideSecond);
    await deletePair(admin, fx.groomSecond, fx.brideFirst);
    await clearEvents(admin, cardIds);
    await resetCardRules(admin, cardIds);
  };

  test.beforeEach(reset);
  test.afterEach(reset);

  test.describe("כתיבה ליומן", () => {
    test("שליחה לשני הצדדים - שורה אחת לכל כרטיס, עם snapshot של השמות", async () => {
      // Act
      const { id, error } = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
        scope: "both",
      });

      // Assert
      expect(error).toBeNull();
      const events = await listEvents(admin, cardIds);
      expect(events).toHaveLength(2);
      const groomEvent = events.find((e) => e.side === "groom");
      const brideEvent = events.find((e) => e.side === "bride");
      expect(groomEvent?.student_id).toBe(fx.groomFirst);
      expect(groomEvent?.other_student_id).toBe(fx.brideFirst);
      expect(brideEvent?.student_id).toBe(fx.brideFirst);
      expect(brideEvent?.other_student_id).toBe(fx.groomFirst);
      expect(groomEvent?.shidduch_id).toBe(id);
      expect(groomEvent?.shadchan_id).toBe(testUserId);
      expect(groomEvent?.kind).toBe("offer_sent");
      expect(groomEvent?.student_name).toContain("מיועד");
      expect(groomEvent?.other_student_name).toContain("מיועדת");
    });

    test("טיוטה, ושלב ראשון של שליחה לפני המייל - לא נרשמים", async () => {
      // Act
      const { error } = await admin.from("shidduchim").insert([
        {
          groom_id: fx.groomFirst,
          bride_id: fx.brideFirst,
          shadchan_id: testUserId,
          status: "draft",
        },
        {
          groom_id: fx.groomFirst,
          bride_id: fx.brideSecond,
          shadchan_id: testUserId,
          status: "sent",
          recipient_scope: "both",
          sent_at: null,
        },
      ]);

      // Assert
      expect(error).toBeNull();
      expect(await listEvents(admin, cardIds)).toHaveLength(0);
    });

    test("שליחה לצד אחד והרחבה לצד השני - רק הצד שנוסף נרשם", async () => {
      // Arrange
      const { id } = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
        scope: "groom_only",
      });
      expect(await listEvents(admin, cardIds)).toHaveLength(1);

      // Act - כמו send-other-side/route.ts: היקף וחותמת בכתיבה אחת
      const { error } = await admin
        .from("shidduchim")
        .update({ recipient_scope: "both", sent_at: new Date().toISOString() })
        .eq("id", id);

      // Assert
      expect(error).toBeNull();
      const events = await listEvents(admin, cardIds);
      expect(events.map((e) => e.side).sort()).toEqual(["bride", "groom"]);
    });

    test("שורה שנדחתה ונשלחת שוב - נרשמת שליחה חדשה, וגם פתיחה מחדש ידנית של שדכן", async () => {
      // Arrange
      const { id } = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
        scope: "groom_only",
      });
      await admin
        .from("shidduchim")
        .update({ status: "rejected" })
        .eq("id", id);

      // Act - שליחה חוזרת של השורה שנדחתה (שימוש חוזר ב-offer/route.ts)
      const resend = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: fx.otherShadchanId,
        scope: "groom_only",
        reuseId: id!,
      });

      // Assert
      expect(resend.error).toBeNull();
      const afterResend = await listEvents(admin, cardIds);
      expect(afterResend).toHaveLength(2);
      expect(afterResend[1].shadchan_id).toBe(fx.otherShadchanId);

      // Act - שדכן מחזיר ידנית את הסטטוס: זו שליחה חוזרת לכל דבר (נבדקת
      // במכסה וההשהיה), ולכן נרשמת. חזרה של הורה מדחייה אינה נרשמת -
      // ראו proposal-gate-bypass.spec.ts
      await admin
        .from("shidduchim")
        .update({ status: "rejected" })
        .eq("id", id);
      await admin
        .from("shidduchim")
        .update({ status: "interested" })
        .eq("id", id);
      expect(await listEvents(admin, cardIds)).toHaveLength(3);
    });

    test("מחיקת ההצעה לא מוחקת את היומן", async () => {
      // Arrange
      const { id } = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
        scope: "both",
      });

      // Act
      await admin.from("shidduchim").delete().eq("id", id);

      // Assert
      const events = await listEvents(admin, cardIds);
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.shidduch_id === id)).toBe(true);
    });
  });

  test.describe("מכסת הצעות", () => {
    const limitCard = async (
      studentId: string,
      count: number,
      period: string,
    ) => {
      const { error } = await admin
        .from("students")
        .update({ proposal_limit_count: count, proposal_limit_period: period })
        .eq("id", studentId);
      expect(error).toBeNull();
    };

    test("מכסה מלאה - סירוב ברור עם שעות עד שתתפנה, בלי שורה ובלי אירוע חדש", async ({
      request,
    }) => {
      // Arrange - הצעה אחת לפני 20 שעות מלאה מכסה של אחת ליום
      await limitCard(fx.groomFirst, 1, "day");
      await seedEvent(admin, {
        shadchanId: fx.otherShadchanId,
        studentId: fx.groomFirst,
        otherStudentId: fx.brideSecond,
        side: "groom",
        createdAt: hoursAgo(20),
      });

      // Act
      const response = await request.post(OFFER_ENDPOINT, {
        data: {
          groomId: fx.groomFirst,
          brideId: fx.brideFirst,
          action: "send",
          recipientScope: "groom_only",
        },
      });

      // Assert
      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("proposal_limit_reached");
      expect(body.error).toContain("הגיע למכסת ההצעות שקבע מנהל הכרטיס");
      expect(body.error).toMatch(/בעוד (שעה|\d+ שעות)\./);
      expect(await listEvents(admin, cardIds)).toHaveLength(1);
      const { count } = await admin
        .from("shidduchim")
        .select("id", { count: "exact", head: true })
        .eq("groom_id", fx.groomFirst)
        .eq("bride_id", fx.brideFirst);
      expect(count).toBe(0);
    });

    test("מכסה שבועית - ההמתנה בימים", async ({ request }) => {
      // Arrange - אירוע לפני יומיים, מכסה של אחת לשבוע: מתפנה בעוד 5 ימים
      await limitCard(fx.groomFirst, 1, "week");
      await seedEvent(admin, {
        shadchanId: fx.otherShadchanId,
        studentId: fx.groomFirst,
        otherStudentId: fx.brideSecond,
        side: "groom",
        createdAt: daysAgo(2),
      });

      // Act
      const response = await request.post(OFFER_ENDPOINT, {
        data: {
          groomId: fx.groomFirst,
          brideId: fx.brideFirst,
          action: "send",
          recipientScope: "groom_only",
        },
      });

      // Assert
      expect(response.status()).toBe(409);
      expect((await response.json()).error).toContain("בעוד 5 ימים");
    });

    test("אירוע שיצא מהחלון לא נספר, ואירוע בתוכו כן", async () => {
      // Arrange - מכסה של שניים ליום: אחד לפני 3 ימים (מחוץ לחלון), אחד לפני שעה
      await limitCard(fx.groomFirst, 2, "day");
      await seedEvent(admin, {
        shadchanId: fx.otherShadchanId,
        studentId: fx.groomFirst,
        otherStudentId: fx.brideSecond,
        side: "groom",
        createdAt: daysAgo(3),
      });
      await seedEvent(admin, {
        shadchanId: fx.otherShadchanId,
        studentId: fx.groomFirst,
        otherStudentId: fx.brideFirst,
        side: "groom",
        createdAt: hoursAgo(1),
      });

      // Act
      const { data, error } = await admin.rpc("student_proposal_quota", {
        p_student_id: fx.groomFirst,
      });

      // Assert - נספר אחד בלבד, ולכן עדיין יש מקום להצעה
      expect(error).toBeNull();
      expect(data?.[0]).toMatchObject({
        is_paused: false,
        limit_count: 2,
        limit_period: "day",
        used_count: 1,
        retry_at: null,
      });
    });

    test("שליחה לשני הצדדים כשרק צד אחד חרג - כל השליחה נדחית ואומרת איזה צד", async ({
      request,
    }) => {
      // Arrange - המיועדת מלאה, המיועד פנוי
      await limitCard(fx.brideFirst, 1, "day");
      await seedEvent(admin, {
        shadchanId: fx.otherShadchanId,
        studentId: fx.brideFirst,
        otherStudentId: fx.groomSecond,
        side: "bride",
        createdAt: hoursAgo(1),
      });

      // Act
      const response = await request.post(OFFER_ENDPOINT, {
        data: {
          groomId: fx.groomFirst,
          brideId: fx.brideFirst,
          action: "send",
          recipientScope: "both",
        },
      });

      // Assert
      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.sides).toEqual(["bride"]);
      expect(body.error).toContain("כרטיס המיועדת");
      expect(body.error).not.toContain("כרטיס המיועד ");
      const { count } = await admin
        .from("shidduchim")
        .select("id", { count: "exact", head: true })
        .eq("groom_id", fx.groomFirst)
        .eq("bride_id", fx.brideFirst);
      expect(count).toBe(0);
    });

    test("שליחה משלימה לצד שמילא את המכסה - נדחית", async ({ request }) => {
      // Arrange - הצעה שנשלחה למיועד בלבד, והמיועדת כבר מלאה
      const { id } = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
        scope: "groom_only",
      });
      await limitCard(fx.brideFirst, 1, "day");
      await seedEvent(admin, {
        shadchanId: fx.otherShadchanId,
        studentId: fx.brideFirst,
        otherStudentId: fx.groomSecond,
        side: "bride",
        createdAt: hoursAgo(1),
      });

      // Act
      const response = await request.post(SEND_OTHER_SIDE_ENDPOINT, {
        data: { shidduchId: id },
      });

      // Assert
      expect(response.status()).toBe(409);
      expect((await response.json()).code).toBe("proposal_limit_reached");
      const { data } = await admin
        .from("shidduchim")
        .select("recipient_scope")
        .eq("id", id)
        .single();
      expect(data?.recipient_scope).toBe("groom_only");
    });

    test("הטריגר במסד חוסם גם כתיבה ישירה (שכבה שאי אפשר לעקוף)", async () => {
      // Arrange
      await limitCard(fx.groomFirst, 1, "day");
      await seedEvent(admin, {
        shadchanId: fx.otherShadchanId,
        studentId: fx.groomFirst,
        otherStudentId: fx.brideSecond,
        side: "groom",
        createdAt: hoursAgo(1),
      });

      // Act
      const result = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
        scope: "both",
      });

      // Assert
      expect(result.error).toContain("proposal_limit_reached");
    });

    test("אילוצי המסד: מספר מחוץ לטווח ותקופה בלי מספר נדחים", async () => {
      // Act
      const zero = await admin
        .from("students")
        .update({ proposal_limit_count: 0, proposal_limit_period: "day" })
        .eq("id", fx.groomFirst);
      const huge = await admin
        .from("students")
        .update({ proposal_limit_count: 101, proposal_limit_period: "day" })
        .eq("id", fx.groomFirst);
      const lonely = await admin
        .from("students")
        .update({ proposal_limit_count: null, proposal_limit_period: "day" })
        .eq("id", fx.groomFirst);

      // Assert
      expect(zero.error).not.toBeNull();
      expect(huge.error).not.toBeNull();
      expect(lonely.error).not.toBeNull();
    });
  });

  test.describe("השהיה", () => {
    test("כרטיס מושהה - הצעה חדשה נדחית, והצעה קיימת נשארת", async ({
      request,
    }) => {
      // Arrange - הצעה קיימת לפני ההשהיה
      const existing = await simulateSend(admin, {
        groomId: fx.groomSecond,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
        scope: "both",
      });
      await admin
        .from("students")
        .update({ in_shidduchim: false })
        .eq("id", fx.groomFirst);

      // Act
      const response = await request.post(OFFER_ENDPOINT, {
        data: {
          groomId: fx.groomFirst,
          brideId: fx.brideSecond,
          action: "send",
          recipientScope: "both",
        },
      });

      // Assert
      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("card_paused");
      expect(body.error).toContain("מושהה כרגע ואינו מקבל הצעות");
      const { data } = await admin
        .from("shidduchim")
        .select("status")
        .eq("id", existing.id)
        .single();
      expect(data?.status).toBe("sent");
    });

    test("טיוטה לכרטיס מושהה עדיין נשמרת - ההשהיה חוסמת קבלת הצעה, לא עבודת שדכן", async ({
      request,
    }) => {
      // Arrange
      await admin
        .from("students")
        .update({ in_shidduchim: false })
        .eq("id", fx.groomFirst);

      // Act
      const response = await request.post(OFFER_ENDPOINT, {
        data: {
          groomId: fx.groomFirst,
          brideId: fx.brideSecond,
          action: "draft",
        },
      });

      // Assert
      expect(response.status()).toBe(200);
    });

    test("הטריגר במסד חוסם הצעה לכרטיס מושהה גם בכתיבה ישירה", async () => {
      // Arrange
      await admin
        .from("students")
        .update({ in_shidduchim: false })
        .eq("id", fx.brideFirst);

      // Act
      const result = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId: testUserId,
        scope: "bride_only",
      });

      // Assert
      expect(result.error).toContain("card_paused");
    });
  });
});
