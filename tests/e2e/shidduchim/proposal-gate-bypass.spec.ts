import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { CARD_MANAGER_EMAIL, clientAs } from "../chats/context-fixtures";
import {
  createServiceClient,
  deletePair,
  getTestUserId,
  insertShidduch,
  setupShidduchFixtures,
  TEST_USER_EMAIL,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "./fixtures";
import {
  clearEvents,
  hoursAgo,
  listEvents,
  resetCardRules,
  seedEvent,
  simulateSend,
} from "./proposal-events";

/**
 * עקיפת המכסה וההשהיה בכתיבה ישירה ל-shidduchim. השדכן כותב לטבלה דרך RLS
 * (סשן אמיתי שלו), ולכן הטריגר הוא קו ההגנה היחיד:
 *   A. טיוטה -> sent עם היקף ו-sent_at בעדכון אחד
 *   B. שורה שנדחתה (ועדיין נושאת sent_at) שנפתחת מחדש
 *   C. הורה שחוזר בו מדחייה אינו נחסם ואינו נרשם
 *   D. שליחות מקבילות / שלב ראשון תופסות מקום במכסה
 */
test.describe("שער המכסה וההשהיה - כתיבה ישירה", () => {
  let admin: SupabaseClient;
  let shadchan: SupabaseClient;
  let parent: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let cardIds: string[];

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    cardIds = [fx.groomFirst, fx.groomSecond, fx.brideFirst, fx.brideSecond];
    shadchan = await clientAs(admin, TEST_USER_EMAIL);
    parent = await clientAs(admin, CARD_MANAGER_EMAIL);
  });

  test.afterAll(async () => {
    await teardownShidduchFixtures(admin, fx);
  });

  const reset = async () => {
    await deletePair(admin, fx.groomFirst, fx.brideFirst);
    await deletePair(admin, fx.groomFirst, fx.brideSecond);
    await clearEvents(admin, cardIds);
    await resetCardRules(admin, cardIds);
  };
  test.beforeEach(reset);
  test.afterEach(reset);

  const limitGroom = async () => {
    await admin
      .from("students")
      .update({ proposal_limit_count: 1, proposal_limit_period: "day" })
      .eq("id", fx.groomFirst);
    await seedEvent(admin, {
      shadchanId: fx.otherShadchanId,
      studentId: fx.groomFirst,
      otherStudentId: fx.brideSecond,
      side: "groom",
      createdAt: hoursAgo(1),
    });
  };

  const pauseGroom = async () => {
    await admin
      .from("students")
      .update({ in_shidduchim: false })
      .eq("id", fx.groomFirst);
  };

  const rowStatus = async (id: string) => {
    const { data } = await admin
      .from("shidduchim")
      .select("status, sent_at")
      .eq("id", id)
      .single();
    return data;
  };

  test.describe("א. טיוטה לשליחה בעדכון אחד", () => {
    test("מכסה מלאה - הטריגר חוסם גם כש-sent_at נקבע באותו עדכון", async () => {
      // Arrange
      const id = await insertShidduch(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId,
      });
      await limitGroom();

      // Act
      const { error } = await shadchan
        .from("shidduchim")
        .update({
          status: "sent",
          recipient_scope: "groom_only",
          sent_at: new Date().toISOString(),
        })
        .eq("id", id);

      // Assert
      expect(error?.message).toContain("proposal_limit_reached");
      expect((await rowStatus(id))?.status).toBe("draft");
    });

    test("כרטיס מושהה - נחסם באותו אופן", async () => {
      // Arrange
      const id = await insertShidduch(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId,
      });
      await pauseGroom();

      // Act
      const { error } = await shadchan
        .from("shidduchim")
        .update({
          status: "sent",
          recipient_scope: "both",
          sent_at: new Date().toISOString(),
        })
        .eq("id", id);

      // Assert
      expect(error?.message).toContain("card_paused");
    });

    test("כרטיס פנוי - המעבר עובר ונרשם אירוע לכל צד", async () => {
      // Arrange
      const id = await insertShidduch(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId,
      });

      // Act
      const { error } = await shadchan
        .from("shidduchim")
        .update({
          status: "sent",
          recipient_scope: "both",
          sent_at: new Date().toISOString(),
        })
        .eq("id", id);

      // Assert
      expect(error).toBeNull();
      expect(await listEvents(admin, cardIds)).toHaveLength(2);
    });
  });

  test.describe("ב. פתיחה מחדש של הצעה שנדחתה", () => {
    const rejectedRow = async () => {
      const { id } = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId,
        scope: "groom_only",
      });
      await admin
        .from("shidduchim")
        .update({ status: "rejected" })
        .eq("id", id);
      return id!;
    };

    test("מכסה מלאה - פתיחה ישירה חזרה ל-in_progress נחסמת, והסטטוס נשאר", async () => {
      // Arrange
      const id = await rejectedRow();
      await limitGroom();

      // Act
      const { error } = await shadchan
        .from("shidduchim")
        .update({ status: "in_progress" })
        .eq("id", id);

      // Assert
      expect(error?.message).toContain("proposal_limit_reached");
      expect((await rowStatus(id))?.status).toBe("rejected");
    });

    test("כרטיס מושהה - set_shidduch_status_as נחסם", async () => {
      // Arrange
      const id = await rejectedRow();
      await pauseGroom();

      // Act
      const { error } = await admin.rpc("set_shidduch_status_as", {
        p_shidduch_id: id,
        p_status: "sent",
        p_actor: shadchanId,
      });

      // Assert
      expect(error?.message).toContain("card_paused");
    });

    test("route הסטטוס מחזיר 409 ברור במקום 500", async ({ request }) => {
      // Arrange
      const id = await rejectedRow();
      await pauseGroom();

      // Act
      const response = await request.patch("/api/v1/shidduchim/status", {
        data: { shidduchId: id, status: "sent" },
      });

      // Assert
      expect(response.status()).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("card_paused");
      expect(body.error).toBeTruthy();
    });

    test("כרטיס פנוי - הפתיחה מחדש עוברת ונרשמת כשליחה חדשה", async () => {
      // Arrange
      const id = await rejectedRow();
      expect(await listEvents(admin, cardIds)).toHaveLength(1);

      // Act
      const { error } = await shadchan
        .from("shidduchim")
        .update({ status: "in_progress" })
        .eq("id", id);

      // Assert
      expect(error).toBeNull();
      expect(await listEvents(admin, cardIds)).toHaveLength(2);
    });
  });

  test.describe("ג. חזרת הורה מדחייה", () => {
    test("הורה שדחה וחוזר בו - לא נחסם גם בכרטיס מושהה, ולא נרשמת שליחה", async () => {
      // Arrange - מנהל הכרטיסים הוא בעל שני הצדדים
      const { id } = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId,
        scope: "groom_only",
      });
      const reject = await parent.rpc("respond_to_shidduch", {
        p_shidduch_id: id,
        p_side: "groom",
        p_response: "rejected",
      });
      expect(reject.error).toBeNull();
      await pauseGroom();
      const before = await listEvents(admin, cardIds);

      // Act
      const takeBack = await parent.rpc("respond_to_shidduch", {
        p_shidduch_id: id,
        p_side: "groom",
        p_response: "interested",
      });

      // Assert
      expect(takeBack.error).toBeNull();
      expect((await rowStatus(id!))?.status).toBe("interested");
      expect(await listEvents(admin, cardIds)).toHaveLength(before.length);
    });
  });

  test.describe("ד. מקביליות ושלב ראשון", () => {
    test("שליחה בשלב ראשון (בלי sent_at) תופסת מקום במכסה", async () => {
      // Arrange
      await admin
        .from("students")
        .update({ proposal_limit_count: 1, proposal_limit_period: "day" })
        .eq("id", fx.groomFirst);
      const first = await admin.from("shidduchim").insert({
        groom_id: fx.groomFirst,
        bride_id: fx.brideFirst,
        shadchan_id: shadchanId,
        status: "sent",
        recipient_scope: "groom_only",
        sent_at: null,
      });
      expect(first.error).toBeNull();

      // Act
      const second = await admin.from("shidduchim").insert({
        groom_id: fx.groomFirst,
        bride_id: fx.brideSecond,
        shadchan_id: shadchanId,
        status: "sent",
        recipient_scope: "groom_only",
        sent_at: null,
      });

      // Assert
      expect(second.error?.message).toContain("proposal_limit_reached");
    });

    test("שתי שליחות מקבילות במכסה של אחת - בדיוק אחת עוברת", async () => {
      // Arrange
      await admin
        .from("students")
        .update({ proposal_limit_count: 1, proposal_limit_period: "day" })
        .eq("id", fx.groomFirst);

      // Act
      const results = await Promise.all([
        simulateSend(admin, {
          groomId: fx.groomFirst,
          brideId: fx.brideFirst,
          shadchanId,
          scope: "groom_only",
        }),
        simulateSend(admin, {
          groomId: fx.groomFirst,
          brideId: fx.brideSecond,
          shadchanId,
          scope: "groom_only",
        }),
      ]);

      // Assert
      expect(results.filter((r) => r.error === null)).toHaveLength(1);
      expect(
        results.filter((r) => r.error?.includes("proposal_limit_reached")),
      ).toHaveLength(1);
      expect(await listEvents(admin, cardIds)).toHaveLength(1);
    });
  });

  test.describe("ה. הצמדה מחדש של הצעה פעילה לכרטיס אחר", () => {
    const sendAs = async (status: "sent" | "rejected" = "sent") => {
      const { id } = await simulateSend(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId,
        scope: "both",
      });
      if (status === "rejected") {
        await admin.from("shidduchim").update({ status }).eq("id", id);
      }
      return id!;
    };

    const rowIds = async (id: string) => {
      const { data } = await admin
        .from("shidduchim")
        .select("groom_id, bride_id, shadchan_id")
        .eq("id", id)
        .single();
      return data;
    };

    test("הצעה פעילה: החלפת groom_id לכרטיס מושהה נחסמת, ושום דבר לא משתנה", async () => {
      // Arrange
      const id = await sendAs();
      await admin
        .from("students")
        .update({ in_shidduchim: false })
        .eq("id", fx.groomSecond);

      // Act
      const { error } = await shadchan
        .from("shidduchim")
        .update({ groom_id: fx.groomSecond })
        .eq("id", id);

      // Assert
      expect(error?.message).toContain("shidduch_cards_immutable");
      expect((await rowIds(id))?.groom_id).toBe(fx.groomFirst);
    });

    test("הצעה פעילה: החלפת bride_id נחסמת, וגם הצעה שנדחתה", async () => {
      // Arrange
      const activeId = await sendAs();

      // Act
      const active = await shadchan
        .from("shidduchim")
        .update({ bride_id: fx.brideSecond })
        .eq("id", activeId);
      await admin
        .from("shidduchim")
        .update({ status: "rejected" })
        .eq("id", activeId);
      const rejected = await shadchan
        .from("shidduchim")
        .update({ bride_id: fx.brideSecond })
        .eq("id", activeId);

      // Assert
      expect(active.error?.message).toContain("shidduch_cards_immutable");
      expect(rejected.error?.message).toContain("shidduch_cards_immutable");
      expect((await rowIds(activeId))?.bride_id).toBe(fx.brideFirst);
    });

    test("הצעה פעילה: גם הצמדה למכסה מלאה נחסמת (כתיבה ללא רישום ביומן)", async () => {
      // Arrange
      const id = await sendAs();
      await admin
        .from("students")
        .update({ proposal_limit_count: 1, proposal_limit_period: "day" })
        .eq("id", fx.groomSecond);
      await seedEvent(admin, {
        shadchanId: fx.otherShadchanId,
        studentId: fx.groomSecond,
        otherStudentId: fx.brideSecond,
        side: "groom",
        createdAt: hoursAgo(1),
      });

      // Act
      const { error } = await shadchan
        .from("shidduchim")
        .update({ groom_id: fx.groomSecond })
        .eq("id", id);

      // Assert
      expect(error?.message).toContain("shidduch_cards_immutable");
      expect((await rowIds(id))?.groom_id).toBe(fx.groomFirst);
    });

    test("טיוטה עדיין ניתנת לשינוי כרטיס", async () => {
      // Arrange
      const id = await insertShidduch(admin, {
        groomId: fx.groomFirst,
        brideId: fx.brideFirst,
        shadchanId,
      });

      // Act
      const { error } = await shadchan
        .from("shidduchim")
        .update({ bride_id: fx.brideSecond })
        .eq("id", id);

      // Assert
      expect(error).toBeNull();
      expect((await rowIds(id))?.bride_id).toBe(fx.brideSecond);
    });

    test("שורה שנדחתה מוכנסת מחדש ע'י נתיב השליחה (service role): הבעלות עוברת והכרטיסים נשארים", async () => {
      // Arrange
      const id = await sendAs("rejected");

      // Act
      const { error } = await admin
        .from("shidduchim")
        .update({ shadchan_id: fx.otherShadchanId, status: "sent" })
        .eq("id", id);

      // Assert
      expect(error).toBeNull();
      const row = await rowIds(id);
      expect(row?.shadchan_id).toBe(fx.otherShadchanId);
      expect(row?.groom_id).toBe(fx.groomFirst);
    });
  });
});
