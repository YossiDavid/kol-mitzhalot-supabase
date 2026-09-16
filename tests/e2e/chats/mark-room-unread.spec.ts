import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

/**
 * "סימון כלא נקרא" בלחיצה ימנית על שורת השיחה. זהו סימון עצמי - "לטיפול
 * בהמשך" - ולכן הוא עובד גם בשיחה שאני שלחתי בה אחרון, ונמחק כשהשיחה
 * נפתחת.
 */
const admin = createServiceClient();

const OTHER_USER_NAME = "Fixture Manager";
const MENU_ITEM = "סימון כלא נקרא";
const REALTIME_TIMEOUT_MS = 15_000;
const RUN_ID = Date.now();

let testUserId: string;
let managerId: string;
let roomId: string;

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

async function sendMessage(senderId: string, content: string): Promise<void> {
  const { error } = await admin
    .from("chat_messages")
    .insert({ room_id: roomId, sender_id: senderId, content });
  if (error) throw new Error(`שליחת הודעה נכשלה: ${error.message}`);
}

/** כל שיחה אחרת שנשארה פתוחה הייתה מדליקה סימון שאינו של הבדיקה */
async function markAllRoomsRead(): Promise<void> {
  const { error } = await admin
    .from("chat_room_participants")
    .update({ last_read_at: new Date().toISOString(), marked_unread_at: null })
    .eq("user_id", testUserId);
  if (error) throw new Error(`איפוס הקריאה נכשל: ${error.message}`);
}

const roomsAside = (page: Page) =>
  page.getByRole("complementary", { name: "רשימת הצ׳אטים" });

const roomRow = (page: Page): Locator =>
  roomsAside(page).getByRole("link", { name: new RegExp(OTHER_USER_NAME) });

const menuItem = (page: Page): Locator =>
  page.getByRole("menuitem", { name: MENU_ITEM });

const expectUnread = (locator: Locator) =>
  expect(locator).toHaveAttribute("data-unread", "true", {
    timeout: REALTIME_TIMEOUT_MS,
  });

const expectRead = (locator: Locator) =>
  expect(locator).not.toHaveAttribute("data-unread", "true", {
    timeout: REALTIME_TIMEOUT_MS,
  });

async function openRoomList(page: Page) {
  await page.goto("/app/chats");
  await expect(roomRow(page)).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
}

async function markUnreadFromMenu(page: Page) {
  await roomRow(page).click({ button: "right" });
  await expect(menuItem(page)).toBeVisible();
  await expect(menuItem(page)).not.toHaveAttribute("aria-disabled", "true");
  await menuItem(page).click();
}

test.describe.configure({ mode: "serial" });

test.describe("סימון שיחה כלא נקראה", () => {
  test.beforeAll(async () => {
    testUserId = await getTestUserId(admin);
    managerId = await ensureCardManagerId(admin);
    await deleteRoomBetween(testUserId, managerId);
    await markAllRoomsRead();
    roomId = await createRoom();
  });

  test.afterAll(async () => {
    if (roomId) {
      await admin.from("notifications").delete().eq("related_id", roomId);
    }
    await deleteRoomBetween(testUserId, managerId);
  });

  test("שיחה שנקראה חוזרת להיות מסומנת", async ({ page }) => {
    // Arrange - הודעה מהצד השני, ופתיחת השיחה מסמנת אותה כנקראה
    await sendMessage(managerId, `הודעה לסימון ${RUN_ID}`);
    await openRoomList(page);
    await roomRow(page).click();
    await expect(
      page.getByRole("log", { name: "הודעות" }).getByText(`${RUN_ID}`),
    ).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
    await openRoomList(page);
    await expectRead(roomRow(page));

    // Act
    await markUnreadFromMenu(page);

    // Assert
    await expectUnread(roomRow(page));
  });

  test("שיחה שכבר מסומנת - הפריט מושבת", async ({ page }) => {
    // Arrange - המצב מהבדיקה הקודמת
    await openRoomList(page);
    await expectUnread(roomRow(page));

    // Act
    await roomRow(page).click({ button: "right" });

    // Assert
    await expect(menuItem(page)).toHaveAttribute("aria-disabled", "true");
  });

  test("גם כשאני שלחתי אחרון אפשר לסמן, ופתיחת השיחה מנקה", async ({
    page,
  }) => {
    // Arrange - ההודעה האחרונה שלי, והשיחה נקראה. כאן הסימון אינו ניתן
    // לגזירה משום נתון קיים, ולכן הוא הסימון העצמי "לטיפול בהמשך"
    await sendMessage(testUserId, `הודעה ממני ${RUN_ID}`);
    await markAllRoomsRead();
    await openRoomList(page);
    await expectRead(roomRow(page));

    // Act
    await markUnreadFromMenu(page);

    // Assert - הנקודה נדלקת למרות שההודעה האחרונה שלי
    await expectUnread(roomRow(page));

    // Act - פתיחת השיחה היא הטיפול, ולכן היא מנקה את הסימון
    await roomRow(page).click();
    await expect(
      page
        .getByRole("log", { name: "הודעות" })
        .getByText(`הודעה ממני ${RUN_ID}`),
    ).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
    await openRoomList(page);

    // Assert
    await expectRead(roomRow(page));
  });
});
