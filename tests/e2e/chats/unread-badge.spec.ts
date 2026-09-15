import { test, expect, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

/**
 * תג השיחות שלא נקראו ליד "צ'אטים" בניווט: מופיע כשנכנסת הודעה מאדם אחר,
 * נעלם כשהשיחה נפתחת, וחוזר ב-realtime כשנכנסת הודעה נוספת בזמן שהמשתמש
 * בדף אחר — בלי טעינה מחדש.
 */
const admin = createServiceClient();

const CHATS_TITLE = "צ'אטים";
const ONE_UNREAD_LABEL = `${CHATS_TITLE}, שיחה אחת שלא נקראה`;
const REALTIME_TIMEOUT_MS = 15_000;
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const RUN_ID = Date.now();

let testUserId: string;
let managerId: string;
let roomId: string;

type ReloadMarkerWindow = Window & { __unreadBadgeNoReload?: boolean };

async function deleteRoomBetween(first: string, second: string) {
  const [userA, userB] = [first, second].sort();
  const { error } = await admin
    .from("chat_rooms")
    .delete()
    .eq("user_a", userA)
    .eq("user_b", userB);
  if (error) throw new Error(`ניקוי שיחת הבדיקה נכשל: ${error.message}`);
}

async function createRoom(): Promise<string> {
  const [userA, userB] = [testUserId, managerId].sort();
  // משתמש הבדיקה (שדכן) פותח את השיחה: כך טריגר מכסת הפניות לשדכנים לא
  // נכנס לתמונה — הצד השני אינו שדכן.
  const { data, error } = await admin
    .from("chat_rooms")
    .insert({ user_a: userA, user_b: userB, created_by: testUserId })
    .select("room_id")
    .single();
  if (error || !data) {
    throw new Error(`יצירת שיחת הבדיקה נכשלה: ${error?.message}`);
  }

  const newRoomId = data.room_id as string;
  const { error: participantsError } = await admin
    .from("chat_room_participants")
    .insert([
      { room_id: newRoomId, user_id: testUserId },
      { room_id: newRoomId, user_id: managerId },
    ]);
  if (participantsError) {
    throw new Error(`הוספת משתתפי השיחה נכשלה: ${participantsError.message}`);
  }
  return newRoomId;
}

async function sendFromManager(content: string): Promise<string> {
  const { data, error } = await admin
    .from("chat_messages")
    .insert({ room_id: roomId, sender_id: managerId, content })
    .select("created_at")
    .single();
  if (error || !data) throw new Error(`שליחת הודעה נכשלה: ${error?.message}`);
  return data.created_at as string;
}

async function readUpTo(): Promise<number> {
  const { data, error } = await admin
    .from("chat_room_participants")
    .select("last_read_at")
    .eq("room_id", roomId)
    .eq("user_id", testUserId)
    .single();
  if (error) throw new Error(`קריאת last_read_at נכשלה: ${error.message}`);
  return data.last_read_at ? new Date(data.last_read_at).getTime() : 0;
}

const unreadChatsLink = (page: Page) =>
  page.getByRole("link", { name: ONE_UNREAD_LABEL, exact: true });

const readChatsLink = (page: Page) =>
  page.getByRole("link", { name: CHATS_TITLE, exact: true });

test.describe.configure({ mode: "serial" });

test.describe("תג צ'אטים שלא נקראו", () => {
  test.beforeAll(async () => {
    testUserId = await getTestUserId(admin);
    managerId = await ensureCardManagerId(admin);
    await deleteRoomBetween(testUserId, managerId);

    // שיחות שנשארו פתוחות מבדיקות אחרות היו מוסיפות לספירה. מסמנים את
    // כולן כנקראו כדי שהתג יספור רק את שיחת הבדיקה.
    const { error } = await admin
      .from("chat_room_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("user_id", testUserId);
    if (error) throw new Error(`איפוס הקריאה נכשל: ${error.message}`);

    roomId = await createRoom();
  });

  test.afterAll(async () => {
    if (roomId) {
      await admin.from("notifications").delete().eq("related_id", roomId);
    }
    await deleteRoomBetween(testUserId, managerId);
  });

  test("מופיע בהודעה חדשה, נעלם בפתיחת השיחה וחוזר ב-realtime", async ({
    page,
  }) => {
    const firstMessage = `הודעה ראשונה ${RUN_ID}`;
    await sendFromManager(firstMessage);

    await page.goto("/app");
    const unreadLink = unreadChatsLink(page);
    await expect(unreadLink).toBeVisible();
    await expect(
      unreadLink.locator('[data-slot="unread-chats-badge"]'),
    ).toHaveText("1");

    // פתיחת השיחה מתוך רשימת השיחות מסמנת אותה כנקראה
    await unreadLink.click();
    await expect(page).toHaveURL(/\/app\/chats$/);
    await page
      .getByRole("complementary", { name: "רשימת הצ׳אטים" })
      .getByRole("link", { name: /Fixture Manager/ })
      .click();
    const log = page.getByRole("log", { name: "הודעות" });
    await expect(log.getByText(firstMessage)).toBeVisible();

    await expect(readChatsLink(page)).toBeVisible();
    await expect(unreadLink).toHaveCount(0);
    await expect.poll(readUpTo).toBeGreaterThan(0);

    // הודעה שנכנסת בזמן שהשיחה פתוחה נקראת מיד, והתג לא חוזר
    const whileOpen = `הודעה בזמן שהשיחה פתוחה ${RUN_ID}`;
    const whileOpenAt = new Date(await sendFromManager(whileOpen)).getTime();
    await expect(log.getByText(whileOpen)).toBeVisible({
      timeout: REALTIME_TIMEOUT_MS,
    });
    await expect
      .poll(readUpTo, { timeout: REALTIME_TIMEOUT_MS })
      .toBeGreaterThanOrEqual(whileOpenAt);
    await expect(readChatsLink(page)).toBeVisible();

    // מעבר לדף אחר בניווט צד-לקוח, והודעה נוספת — התג חוזר בלי טעינה
    await page.getByRole("link", { name: "ראשי", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.evaluate(() => {
      (window as ReloadMarkerWindow).__unreadBadgeNoReload = true;
    });

    await sendFromManager(`הודעה כשהמשתמש בדף אחר ${RUN_ID}`);
    await expect(unreadLink).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
    expect(
      await page.evaluate(
        () => (window as ReloadMarkerWindow).__unreadBadgeNoReload,
      ),
    ).toBe(true);
  });

  test("מוצג גם בסרגל הניווט התחתון במובייל", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await sendFromManager(`הודעה למובייל ${RUN_ID}`);

    await page.goto("/app");
    const unreadLink = unreadChatsLink(page);
    await expect(unreadLink).toBeVisible();
    await expect(
      unreadLink.locator('[data-slot="unread-chats-badge"]'),
    ).toHaveText("1");
  });
});
