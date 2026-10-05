import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  TEST_USER_EMAIL,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";
import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
  deleteRoomsAmong,
  ensureSecondParentId,
  getRoom,
  insertProposal,
  openRoomAs,
  sendAs,
} from "./context-fixtures";

/**
 * שרשורי הקשר בצ'אט, ברמת ה-RPC וה-RLS: בין אותם שני משתמשים יש כמה חדרים
 * (כללי / כרטיס / הצעה), וההרשאה ליצור אותם נבדקת בשרת בלבד.
 *
 * הדמויות: השדכן = משתמש הבדיקה; הורה א' = מנהל הכרטיסים (בעל צד החתן);
 * הורה ב' = בעל צד הכלה. משתמש הבדיקה הוא שדכן, ולכן פתיחת חדרים מצדו
 * פטורה ממכסת הפניות היומית.
 */
test.describe("שרשורי הקשר בצ'אט — RPC והרשאות", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let shadchanId: string;
  let parentA: string;
  let parentB: string;
  let strangerId: string;
  let groomCard: string;
  let brideCard: string;
  let proposalId: string;
  let shadchanClient: SupabaseClient;
  let parentAClient: SupabaseClient;
  let parentBClient: SupabaseClient;

  const everyone = () => [shadchanId, parentA, parentB, strangerId];

  test.beforeAll(async () => {
    admin = createServiceClient();
    shadchanId = await getTestUserId(admin);
    fx = await setupShidduchFixtures(admin);
    parentA = fx.cardManagerId;
    strangerId = fx.otherShadchanId;
    parentB = await ensureSecondParentId(admin);

    groomCard = fx.groomFirst;
    brideCard = await createCard(admin, {
      userId: parentB,
      gender: "female",
      firstName: "כלה",
      lastName: "בדיקה",
    });
    await deleteRoomsAmong(admin, everyone());
    proposalId = await insertProposal(admin, {
      groomId: groomCard,
      brideId: brideCard,
      shadchanId,
    });

    [shadchanClient, parentAClient, parentBClient] = await Promise.all([
      clientAs(admin, TEST_USER_EMAIL),
      clientAs(admin, CARD_MANAGER_EMAIL),
      clientAs(admin, "playwright-second-parent@kol-mitzhalot.test"),
    ]);
  });

  test.afterAll(async () => {
    await deleteRoomsAmong(admin, everyone());
    await admin.from("shidduchim").delete().eq("id", proposalId);
    await admin.from("students").delete().eq("id", brideCard);
    await teardownShidduchFixtures(admin, fx);
  });

  test("בין אותם שני משתמשים נפתחים חדרים נפרדים: כללי, כרטיס והצעה", async () => {
    // Act
    const general = await openRoomAs(shadchanClient, parentA, {
      kind: "general",
    });
    const student = await openRoomAs(shadchanClient, parentA, {
      kind: "student",
      studentId: groomCard,
    });
    const shidduch = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });

    // Assert
    expect([general.error, student.error, shidduch.error]).toEqual([
      null,
      null,
      null,
    ]);
    const ids = new Set([general.roomId, student.roomId, shidduch.roomId]);
    expect(ids.size).toBe(3);

    expect(await getRoom(admin, student.roomId!)).toMatchObject({
      context_kind: "student",
      student_id: groomCard,
      context_label: "מיועד ראשון",
    });
    expect(await getRoom(admin, shidduch.roomId!)).toMatchObject({
      context_kind: "shidduch",
      shidduch_id: proposalId,
      context_label: "מיועד ראשון וכלה בדיקה",
    });
  });

  test("אותה קריאה מחזירה אותו חדר, גם מהצד השני", async () => {
    // Arrange
    const first = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });

    // Act
    const again = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });
    const fromParent = await openRoomAs(parentAClient, shadchanId, {
      kind: "shidduch",
      shidduchId: proposalId,
    });

    // Assert
    expect(again.roomId).toBe(first.roomId);
    expect(fromParent.roomId).toBe(first.roomId);
  });

  test("שיחה כללית קיימת לא מושפעת, ו-get_or_create_dm_room עדיין מחזיר אותה", async () => {
    // Arrange - חדר "ישן": נוצר בלי עמודות הקשר, כמו כל חדר שהיה לפני המיגרציה
    await deleteRoomsAmong(admin, [shadchanId, parentB]);
    const [userA, userB] = [shadchanId, parentB].sort();
    const { data: legacy, error } = await admin
      .from("chat_rooms")
      .insert({ user_a: userA, user_b: userB, created_by: shadchanId })
      .select("room_id")
      .single();
    expect(error).toBeNull();
    await admin.from("chat_room_participants").insert([
      { room_id: legacy!.room_id, user_id: shadchanId },
      { room_id: legacy!.room_id, user_id: parentB },
    ]);
    await sendAs(admin, legacy!.room_id, parentB, "הודעה מלפני המיגרציה");

    // Act
    const viaOld = await shadchanClient.rpc("get_or_create_dm_room", {
      other_user_id: parentB,
    });
    const viaNew = await openRoomAs(parentBClient, shadchanId, {
      kind: "general",
    });

    // Assert
    expect(viaOld.error).toBeNull();
    expect(viaOld.data).toBe(legacy!.room_id);
    expect(viaNew.roomId).toBe(legacy!.room_id);
    expect(await getRoom(admin, legacy!.room_id)).toMatchObject({
      context_kind: "general",
      student_id: null,
      shidduch_id: null,
    });
  });

  test("בעל צד אחד אינו יכול לפתוח שרשור הצעה מול בעל הצד השני", async () => {
    const aToB = await openRoomAs(parentAClient, parentB, {
      kind: "shidduch",
      shidduchId: proposalId,
    });
    const bToA = await openRoomAs(parentBClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });

    expect(aToB.error).toContain("context_not_allowed");
    expect(bToA.error).toContain("context_not_allowed");
  });

  test("מי שאינו שדכן ההצעה או בעל צד נדחה", async () => {
    const strangerClient = await clientAs(
      admin,
      "playwright-other-shadchan@kol-mitzhalot.test",
    );

    const asStranger = await openRoomAs(strangerClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });
    const towardsStranger = await openRoomAs(parentAClient, strangerId, {
      kind: "shidduch",
      shidduchId: proposalId,
    });

    expect(asStranger.error).toContain("context_not_allowed");
    expect(towardsStranger.error).toContain("context_not_allowed");
  });

  test("טיוטה אינה זמינה לשרשור", async () => {
    const draftId = await insertProposal(admin, {
      groomId: fx.groomSecond,
      brideId: brideCard,
      shadchanId,
      status: "draft",
    });

    const result = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: draftId,
    });

    expect(result.error).toContain("invalid_context");
    await admin.from("shidduchim").delete().eq("id", draftId);
  });

  test("צד שמחוץ ל-recipient_scope אינו זכאי לשרשור", async () => {
    const groomOnly = await insertProposal(admin, {
      groomId: fx.groomSecond,
      brideId: brideCard,
      shadchanId,
      scope: "groom_only",
    });

    const toBride = await openRoomAs(shadchanClient, parentB, {
      kind: "shidduch",
      shidduchId: groomOnly,
    });
    const toGroom = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: groomOnly,
    });

    expect(toBride.error).toContain("context_not_allowed");
    expect(toGroom.error).toBeNull();
    await admin.from("shidduchim").delete().eq("id", groomOnly);
  });

  test("פנייה על כרטיס: רק בין בעל הכרטיס לשדכן", async () => {
    // הורה ב' אינו בעל כרטיס החתן ואינו שדכן
    const parentToParent = await openRoomAs(parentBClient, parentA, {
      kind: "student",
      studentId: groomCard,
    });
    // השדכן מול מי שאינו בעל הכרטיס
    const wrongOwner = await openRoomAs(shadchanClient, parentB, {
      kind: "student",
      studentId: groomCard,
    });
    // הכיוון ההפוך: בעל הכרטיס פונה לשדכן
    const ownerToShadchan = await openRoomAs(parentAClient, shadchanId, {
      kind: "student",
      studentId: groomCard,
    });

    expect(parentToParent.error).toContain("context_not_allowed");
    expect(wrongOwner.error).toContain("context_not_allowed");
    expect(ownerToShadchan.error).toBeNull();
  });

  test("הקשר שנשלח מהלקוח לא עוקף את הבדיקה: INSERT ישיר של חדר הקשר נחסם", async () => {
    const [userA, userB] = [parentA, parentB].sort();

    const { error } = await parentAClient.from("chat_rooms").insert({
      user_a: userA,
      user_b: userB,
      created_by: parentA,
      context_kind: "shidduch",
      shidduch_id: proposalId,
      context_label: "מזויף",
    });

    expect(error).not.toBeNull();
  });

  test("משתתף בלבד קורא את חדר ההקשר; זר אינו רואה אותו", async () => {
    const room = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });
    await sendAs(admin, room.roomId!, parentA, "סודי להצעה");

    const asParentB = await parentBClient
      .from("chat_messages")
      .select("message_id")
      .eq("room_id", room.roomId!);
    const asParentA = await parentAClient
      .from("chat_messages")
      .select("message_id")
      .eq("room_id", room.roomId!);

    expect(asParentB.data ?? []).toHaveLength(0);
    expect((asParentA.data ?? []).length).toBeGreaterThan(0);
  });

  test("תגובת הורה להצעה עם הודעה נרשמת גם בשרשור, בשם הצד שהגיב", async () => {
    const respond = await parentAClient.rpc("respond_to_shidduch", {
      p_shidduch_id: proposalId,
      p_side: "groom",
      p_response: "interested",
      p_message: "מעוניינים מאוד, נשמח לפרטים",
    });
    expect(respond.error).toBeNull();

    const room = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });
    const { data: messages } = await admin
      .from("chat_messages")
      .select("sender_id, content")
      .eq("room_id", room.roomId!);

    expect(
      (messages ?? []).some(
        (m) =>
          m.sender_id === parentA &&
          String(m.content).includes("מעוניינים מאוד, נשמח לפרטים"),
      ),
    ).toBe(true);
  });

  test("שדכן שהתפקיד נשלל ממנו (app_metadata): אין שרשור חדש על ההצעות הישנות שלו", async () => {
    // Arrange - לפני השלילה ההורה כן יכול לפתוח שרשור מול השדכן
    const { data: before } = await admin.auth.admin.getUserById(shadchanId);
    const originalAppMetadata = before.user!.app_metadata;
    const beforeRevoke = await openRoomAs(parentAClient, shadchanId, {
      kind: "shidduch",
      shidduchId: proposalId,
    });
    expect(beforeRevoke.error).toBeNull();

    try {
      // Act - שלילת התפקיד דרך app_metadata (הנתיב היחיד שנקרא), עם מיזוג
      await admin.auth.admin.updateUserById(shadchanId, {
        app_metadata: { ...originalAppMetadata, roles: [] },
      });
      const asParent = await openRoomAs(parentAClient, shadchanId, {
        kind: "shidduch",
        shidduchId: proposalId,
      });
      const asFormerShadchan = await openRoomAs(shadchanClient, parentA, {
        kind: "shidduch",
        shidduchId: proposalId,
      });

      // Assert
      expect(asParent.error).toContain("context_not_allowed");
      expect(asFormerShadchan.error).toContain("context_not_allowed");
    } finally {
      await admin.auth.admin.updateUserById(shadchanId, {
        app_metadata: originalAppMetadata,
      });
    }
  });

  test("מחיקת ההצעה משאירה את החדר עם התווית שלו", async () => {
    // Arrange
    const room = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });
    await sendAs(admin, room.roomId!, parentA, "הודעה שצריכה לשרוד");

    // Act
    await admin.from("shidduchim").delete().eq("id", proposalId);

    // Assert
    const kept = await getRoom(admin, room.roomId!);
    expect(kept).toMatchObject({
      context_kind: "shidduch",
      shidduch_id: null,
      context_label: "מיועד ראשון וכלה בדיקה",
    });
    const { data: messages } = await admin
      .from("chat_messages")
      .select("message_id")
      .eq("room_id", room.roomId!);
    expect((messages ?? []).length).toBeGreaterThan(0);

    // ההצעה כבר לא קיימת: אי אפשר לפתוח שרשור חדש עליה
    const reopen = await openRoomAs(shadchanClient, parentA, {
      kind: "shidduch",
      shidduchId: proposalId,
    });
    expect(reopen.error).toContain("invalid_context");
  });
});
