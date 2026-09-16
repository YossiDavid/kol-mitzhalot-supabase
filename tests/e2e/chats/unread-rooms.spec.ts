import { test, expect, type Locator, type Page } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

/**
 * סימון "לא נקרא" ברמת השיחה הבודדת: שורה ברשימת הצ'אטים וכרטיס בדשבורד.
 * הסימון נדלק בהודעה מהצד השני, נכבה כשהשיחה נפתחת, ונכבה גם כשהשיחה נקראה
 * במכשיר אחר — בלי טעינה מחדש של הדף.
 */
const admin = createServiceClient();

const OTHER_USER_NAME = "Fixture Manager";
const CHATS_TITLE = "צ'אטים";
const REALTIME_TIMEOUT_MS = 15_000;
const RUN_ID = Date.now();

let testUserId: string;
let managerId: string;
let roomId: string;

type ReloadMarkerWindow = Window & { __unreadRoomsNoReload?: boolean };

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

async function sendFromManager(content: string): Promise<void> {
  const { error } = await admin
    .from("chat_messages")
    .insert({ room_id: roomId, sender_id: managerId, content });
  if (error) throw new Error(`שליחת הודעה נכשלה: ${error.message}`);
}

/** מדמה מכשיר אחר של אותו משתמש שפתח את השיחה וסימן אותה כנקראה */
async function markReadOnAnotherDevice(): Promise<void> {
  const { error } = await admin
    .from("chat_room_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", testUserId);
  if (error) throw new Error(`סימון הקריאה נכשל: ${error.message}`);
}

/** כל שיחה אחרת שנשארה פתוחה הייתה מדליקה סימון שאינו של הבדיקה */
async function markAllRoomsRead(): Promise<void> {
  const { error } = await admin
    .from("chat_room_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("user_id", testUserId);
  if (error) throw new Error(`איפוס הקריאה נכשל: ${error.message}`);
}

const roomsAside = (page: Page) =>
  page.getByRole("complementary", { name: "רשימת הצ׳אטים" });

const roomRow = (page: Page): Locator =>
  roomsAside(page).getByRole("link", { name: new RegExp(OTHER_USER_NAME) });

/** כרטיס השיחה בדשבורד. לשדכן מוצגים שני מקטעי צ'אטים — נבדק הראשון. */
const dashboardChatCard = (page: Page): Locator =>
  page.locator(`a[href="/app/chats/${roomId}"]`).first();

const expectUnread = (locator: Locator) =>
  expect(locator).toHaveAttribute("data-unread", "true", {
    timeout: REALTIME_TIMEOUT_MS,
  });

const expectRead = (locator: Locator) =>
  expect(locator).not.toHaveAttribute("data-unread", "true", {
    timeout: REALTIME_TIMEOUT_MS,
  });

test.describe.configure({ mode: "serial" });

test.describe("סימון שיחה שלא נקראה", () => {
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

  test("הודעה מהצד השני מסמנת את השורה ואת כרטיס הדשבורד, ופתיחת השיחה מנקה", async ({
    page,
  }) => {
    // Arrange
    await sendFromManager(`הודעה לסימון השורה ${RUN_ID}`);

    // Act + Assert - כרטיס הדשבורד
    await page.goto("/app");
    await expectUnread(dashboardChatCard(page));

    // Act + Assert - השורה ברשימת השיחות
    await page.goto("/app/chats");
    await expectUnread(roomRow(page));

    // Act - פתיחת השיחה מסמנת אותה כנקראה
    await roomRow(page).click();
    await expect(
      page.getByRole("log", { name: "הודעות" }).getByText(`${RUN_ID}`),
    ).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });

    // Assert - הסימון נעלם בשורה ובכרטיס הדשבורד
    await expectRead(roomRow(page));
    await page.goto("/app");
    await expectRead(dashboardChatCard(page));
  });

  test("קריאה במכשיר אחר מנקה את השורה ואת התג בלי טעינה מחדש", async ({
    page,
  }) => {
    // Arrange - הודעה חדשה מדליקה את הסימון, והדף נשאר פתוח
    await sendFromManager(`הודעה לקריאה במכשיר אחר ${RUN_ID}`);
    await page.goto("/app/chats");
    await expectUnread(roomRow(page));
    await expect(
      page.getByRole("link", { name: `${CHATS_TITLE}, שיחה אחת שלא נקראה` }),
    ).toBeVisible();

    await page.evaluate(() => {
      (window as ReloadMarkerWindow).__unreadRoomsNoReload = true;
    });

    // Act - מכשיר אחר של אותו משתמש קרא את השיחה
    await markReadOnAnotherDevice();

    // Assert - השורה והתג התנקו, והדף לא נטען מחדש
    await expectRead(roomRow(page));
    await expect(
      page.getByRole("link", { name: CHATS_TITLE, exact: true }),
    ).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
    expect(
      await page.evaluate(
        () => (window as ReloadMarkerWindow).__unreadRoomsNoReload,
      ),
    ).toBe(true);
  });
});
