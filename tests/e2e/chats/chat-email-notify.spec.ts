import { expect, test } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import {
  CARD_MANAGER_EMAIL,
  deleteRoomsAmong,
  pageAs,
} from "./context-fixtures";

/**
 * מייל על הודעת צ'אט למנהל כרטיס: נשלח אחרי הודעה מהשדכן, מוגבל לאחד בחצי
 * שעה לשיחה, ולא נשלח לשדכן. בפיתוח המייל אינו יוצא בפועל, אבל ההגבלה
 * נרשמת ב-chat_email_notices. משתמש הבדיקה הוא שדכן.
 */
const LOAD_TIMEOUT = 15_000;

const admin = createServiceClient();
let shadchanId = "";
let managerId = "";
let roomId = "";

const notifyUrl = (id: string) => `/api/v1/chats/${id}/email-notify`;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  shadchanId = await getTestUserId(admin);
  managerId = await ensureCardManagerId(admin);
  await deleteRoomsAmong(admin, [shadchanId, managerId]);
  const [userA, userB] = [shadchanId, managerId].sort();
  const { data, error } = await admin
    .from("chat_rooms")
    .insert({ user_a: userA, user_b: userB, created_by: shadchanId })
    .select("room_id")
    .single();
  if (error || !data) throw new Error(`יצירת חדר נכשלה: ${error?.message}`);
  roomId = data.room_id as string;
  await admin.from("chat_room_participants").insert([
    { room_id: roomId, user_id: shadchanId },
    { room_id: roomId, user_id: managerId },
  ]);
});

test.afterAll(async () => {
  await deleteRoomsAmong(admin, [shadchanId, managerId]);
});

test("הודעה מהשדכן: מייל למנהל הכרטיס, והודעה נוספת מיד אחריה לא שולחת שוב", async ({
  page,
}) => {
  // Arrange
  await page.goto(`/app/chats/${roomId}`);
  const composer = page.getByRole("textbox", { name: "הודעה חדשה" });
  // השיחה נטענה (בלי זה השליחה נבלעת עד שהמשתמש מזוהה)
  await expect(page.getByText("אין הודעות עדיין").first()).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });

  // Act
  const firstNotify = page.waitForResponse((r) =>
    r.url().endsWith(notifyUrl(roomId)),
  );
  await composer.fill("שלום, יש לי הצעה");
  await page.getByRole("button", { name: "שליחת הודעה" }).click();
  const first = await firstNotify;

  // Assert
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual({ outcome: "sent" });
  const { data: notice } = await admin
    .from("chat_email_notices")
    .select("user_id")
    .eq("room_id", roomId);
  expect(notice).toEqual([{ user_id: managerId }]);

  // Act - הודעה נוספת
  const secondNotify = page.waitForResponse((r) =>
    r.url().endsWith(notifyUrl(roomId)),
  );
  await composer.fill("ועוד פרט");
  await page.getByRole("button", { name: "שליחת הודעה" }).click();

  // Assert
  expect(await (await secondNotify).json()).toEqual({ outcome: "throttled" });
});

test("מנהל הכרטיס עונה: השדכן אינו מקבל מייל", async ({ browser }) => {
  // Arrange
  const managerPage = await pageAs(
    browser,
    admin,
    CARD_MANAGER_EMAIL,
    `/app/chats/${roomId}`,
  );

  try {
    const composer = managerPage.getByRole("textbox", { name: "הודעה חדשה" });
    await expect(managerPage.getByText("ועוד פרט").first()).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });

    // Act
    const notify = managerPage.waitForResponse((r) =>
      r.url().endsWith(notifyUrl(roomId)),
    );
    await composer.fill("תודה, נשמח לשמוע");
    await managerPage.getByRole("button", { name: "שליחת הודעה" }).click();

    // Assert
    expect(await (await notify).json()).toEqual({ outcome: "skipped" });
  } finally {
    await managerPage.context().close();
  }
});

test("בלי הודעה טרייה של השולח, הנתיב דוחה", async ({ request }) => {
  // Arrange - ההודעה האחרונה בשיחה היא של מנהל הכרטיס

  // Act
  const response = await request.post(notifyUrl(roomId));

  // Assert
  expect(response.status()).toBe(403);
});
