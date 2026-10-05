import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createServiceClient,
  getTestUserId,
  setupShidduchFixtures,
  teardownShidduchFixtures,
  type ShidduchFixtures,
} from "../shidduchim/fixtures";
import {
  CARD_MANAGER_EMAIL,
  clientAs,
  deleteRoomsAmong,
  ensureSecondParentId,
  openRoomAs,
} from "./context-fixtures";

/**
 * הרשאות הכתיבה על chat_room_participants ו-chat_messages. שלוש התקיפות
 * שנסגרו: (א) יוצר חדר מוסיף צד שלישי, (ב) הזזת room_id של שורה עצמית,
 * (ג) הזזת הודעה לחדר אחר. והצ'אט הרגיל ממשיך לעבוד.
 *
 * הדמויות: א' = מנהל הכרטיסים, ב' = ההורה השני, ג' = משתמש הבדיקה (זר
 * לשיחה). חדר א'-ב' נפתח ב-RPC; חדר ב'-ג' נכתב ישירות (service role).
 */
test.describe("צ'אט - מדיניות משתתפים והודעות", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let fx: ShidduchFixtures;
  let userA: string;
  let userB: string;
  let userC: string;
  let clientA: SupabaseClient;
  let roomAB: string;
  let roomBC: string;

  const everyone = () => [userA, userB, userC];

  test.beforeAll(async () => {
    admin = createServiceClient();
    fx = await setupShidduchFixtures(admin);
    userA = fx.cardManagerId;
    userB = await ensureSecondParentId(admin);
    userC = await getTestUserId(admin);
    await deleteRoomsAmong(admin, everyone());

    clientA = await clientAs(admin, CARD_MANAGER_EMAIL);
    const opened = await openRoomAs(clientA, userB, { kind: "general" });
    expect(opened.error).toBeNull();
    roomAB = opened.roomId!;

    const [a, b] = [userB, userC].sort();
    const { data, error } = await admin
      .from("chat_rooms")
      .insert({ user_a: a, user_b: b, created_by: userB })
      .select("room_id")
      .single();
    if (error || !data) throw new Error(`יצירת חדר ב'-ג': ${error?.message}`);
    roomBC = data.room_id as string;
    await admin.from("chat_room_participants").insert([
      { room_id: roomBC, user_id: userB },
      { room_id: roomBC, user_id: userC },
    ]);
  });

  test.afterAll(async () => {
    await deleteRoomsAmong(admin, everyone());
    await teardownShidduchFixtures(admin, fx);
  });

  const participantsOf = async (roomId: string) => {
    const { data } = await admin
      .from("chat_room_participants")
      .select("user_id")
      .eq("room_id", roomId);
    return (data ?? []).map((row) => row.user_id as string).sort();
  };

  test("יוצר החדר לא יכול להוסיף משתתף שלישי", async () => {
    // Act
    const { error } = await clientA
      .from("chat_room_participants")
      .insert({ room_id: roomAB, user_id: userC });

    // Assert
    expect(error).not.toBeNull();
    expect(await participantsOf(roomAB)).toEqual([userA, userB].sort());
  });

  test("משתמש לא יכול להכניס את עצמו לחדר של אחרים", async () => {
    // Act
    const { error } = await clientA
      .from("chat_room_participants")
      .insert({ room_id: roomBC, user_id: userA });

    // Assert
    expect(error).not.toBeNull();
    expect(await participantsOf(roomBC)).toEqual([userB, userC].sort());
  });

  test("הזזת room_id של השורה העצמית לחדר אחר נכשלת, והחדר נשאר סגור", async () => {
    // Arrange
    await admin.from("chat_messages").insert({
      room_id: roomBC,
      sender_id: userB,
      content: "סודי ב-ג",
    });

    // Act
    const { error } = await clientA
      .from("chat_room_participants")
      .update({ room_id: roomBC })
      .eq("room_id", roomAB)
      .eq("user_id", userA);

    // Assert
    expect(error).not.toBeNull();
    const { data: visible } = await clientA
      .from("chat_messages")
      .select("message_id")
      .eq("room_id", roomBC);
    expect(visible ?? []).toHaveLength(0);
    expect(await participantsOf(roomAB)).toContain(userA);
  });

  test("שינוי user_id של שורת משתתף נכשל", async () => {
    // Act
    const { error } = await clientA
      .from("chat_room_participants")
      .update({ user_id: userC })
      .eq("room_id", roomAB)
      .eq("user_id", userA);

    // Assert
    expect(error).not.toBeNull();
    expect(await participantsOf(roomAB)).toEqual([userA, userB].sort());
  });

  test("הזזת הודעה עצמית לחדר אחר נכשלת", async () => {
    // Arrange
    const { data: sent, error: sendError } = await clientA
      .from("chat_messages")
      .insert({ room_id: roomAB, sender_id: userA, content: "שלום" })
      .select("message_id")
      .single();
    expect(sendError).toBeNull();

    // Act
    const { error } = await clientA
      .from("chat_messages")
      .update({ room_id: roomBC })
      .eq("message_id", sent!.message_id);

    // Assert
    expect(error).not.toBeNull();
    const { data: row } = await admin
      .from("chat_messages")
      .select("room_id")
      .eq("message_id", sent!.message_id)
      .single();
    expect(row?.room_id).toBe(roomAB);
  });

  test("יצירת חדר ישירה בין שני אחרים נחסמת", async () => {
    // Act
    const [a, b] = [userB, userC].sort();
    const { error } = await clientA
      .from("chat_rooms")
      .insert({ user_a: a, user_b: b, created_by: userA });

    // Assert
    expect(error).not.toBeNull();
  });

  test("צ'אט רגיל: שליחה, עריכה, סימון לא נקרא/נקרא, מחיקה אצלי ופתיחה ב-RPC", async () => {
    // Act - שליחה ועריכה
    const { data: sent, error: sendError } = await clientA
      .from("chat_messages")
      .insert({ room_id: roomAB, sender_id: userA, content: "לעריכה" })
      .select("message_id")
      .single();
    expect(sendError).toBeNull();
    const edit = await clientA
      .from("chat_messages")
      .update({ content: "נערך", edited_at: new Date().toISOString() })
      .eq("message_id", sent!.message_id)
      .select("content")
      .single();

    // Assert
    expect(edit.error).toBeNull();
    expect(edit.data?.content).toBe("נערך");

    // Act - סימונים על השורה העצמית
    const unread = await clientA
      .from("chat_room_participants")
      .update({
        marked_unread_at: new Date().toISOString(),
        last_read_at: null,
      })
      .eq("room_id", roomAB)
      .eq("user_id", userA)
      .select("marked_unread_at");
    const read = await clientA
      .from("chat_room_participants")
      .update({
        last_read_at: new Date().toISOString(),
        marked_unread_at: null,
      })
      .eq("room_id", roomAB)
      .eq("user_id", userA)
      .select("last_read_at");
    const hide = await clientA
      .from("chat_room_participants")
      .update({
        hidden_at: new Date().toISOString(),
        deleted_before: new Date().toISOString(),
      })
      .eq("room_id", roomAB)
      .eq("user_id", userA)
      .select("hidden_at");

    // Assert
    expect(unread.error).toBeNull();
    expect(unread.data).toHaveLength(1);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);
    expect(hide.error).toBeNull();
    expect(hide.data).toHaveLength(1);

    // Act - פתיחה מחדש ב-RPC מחזירה את אותו חדר
    const reopened = await openRoomAs(clientA, userB, { kind: "general" });

    // Assert
    expect(reopened.error).toBeNull();
    expect(reopened.roomId).toBe(roomAB);
  });

  test("יצירת חדר כללי ישירה בין המשתמש לאחר נחסמת (אין חדר רפאים)", async () => {
    // Act
    const [a, b] = [userA, userC].sort();
    const { error } = await clientA
      .from("chat_rooms")
      .insert({ user_a: a, user_b: b, created_by: userA });

    // Assert
    expect(error).not.toBeNull();
    const { data: rooms } = await admin
      .from("chat_rooms")
      .select("room_id")
      .eq("user_a", a)
      .eq("user_b", b);
    expect(rooms ?? []).toHaveLength(0);
  });

  test("שדות שרת בהודעה: created_at / edited_at / message_id לא נקבעים ע'י הלקוח", async () => {
    // Arrange
    const future = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const backdated = new Date(Date.now() - 24 * 3_600_000).toISOString();

    // Act
    const withFuture = await clientA.from("chat_messages").insert({
      room_id: roomAB,
      sender_id: userA,
      content: "מהעתיד",
      created_at: future,
    });
    const withBackdate = await clientA.from("chat_messages").insert({
      room_id: roomAB,
      sender_id: userA,
      content: "מהעבר",
      created_at: backdated,
    });
    const withEdited = await clientA.from("chat_messages").insert({
      room_id: roomAB,
      sender_id: userA,
      content: "עם edited_at מהלקוח",
      edited_at: new Date().toISOString(),
    });
    const withId = await clientA.from("chat_messages").insert({
      room_id: roomAB,
      sender_id: userA,
      content: "מזהה",
      message_id: "00000000-0000-4000-8000-000000000abc",
    });
    const plain = await clientA
      .from("chat_messages")
      .insert({ room_id: roomAB, sender_id: userA, content: "רגילה" });

    // Assert
    expect(withFuture.error).not.toBeNull();
    expect(withBackdate.error).not.toBeNull();
    expect(withEdited.error).not.toBeNull();
    expect(withId.error).not.toBeNull();
    expect(plain.error).toBeNull();
    // קריאה דרך service role: אחרי הבדיקה הקודמת החדר מוסתר אצל א'
    const { data: normal } = await admin
      .from("chat_messages")
      .select("created_at, edited_at")
      .eq("room_id", roomAB)
      .eq("content", "רגילה")
      .single();
    expect(normal?.edited_at).toBeNull();
    expect(
      Math.abs(Date.now() - new Date(normal!.created_at).getTime()),
    ).toBeLessThan(60_000);
    const { data: stored } = await admin
      .from("chat_messages")
      .select("message_id")
      .eq("room_id", roomAB)
      .in("content", ["מהעתיד", "מהעבר", "עם edited_at מהלקוח", "מזהה"]);
    expect(stored ?? []).toHaveLength(0);
  });

  test("חדר קיים שחסר בו משתתף מתוקן בפתיחה מחדש", async () => {
    // Arrange - מדמה חדר רפאים: שורת המשתתף של ב' חסרה
    await admin
      .from("chat_room_participants")
      .delete()
      .eq("room_id", roomAB)
      .eq("user_id", userB);
    expect(await participantsOf(roomAB)).toEqual([userA]);

    // Act
    const reopened = await openRoomAs(clientA, userB, { kind: "general" });

    // Assert
    expect(reopened.error).toBeNull();
    expect(reopened.roomId).toBe(roomAB);
    expect(await participantsOf(roomAB)).toEqual([userA, userB].sort());
  });
});
