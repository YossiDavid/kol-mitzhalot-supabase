import { expect, test } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";
import {
  CARD_MANAGER_EMAIL,
  clientAs,
  createCard,
} from "../chats/context-fixtures";

/**
 * "בתהליך שידוך": מסמנים רק מנהל הכרטיס או מנהל המערכת (לא כל שדכן). כשההנהלה
 * מסמנת, מנהל הכרטיס מקבל התראה; ברשימת המיועדים הכוכב של כרטיס כזה בצבע
 * שונה, עם ההסבר.
 */
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const RUN_ID = Date.now();
const LOAD_TIMEOUT = 15_000;

const service = createServiceClient();
let cardId = "";
let managerId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  managerId = await ensureCardManagerId(service);
  cardId = await createCard(service, {
    userId: managerId,
    gender: "male",
    firstName: "יעקב",
    lastName: `תהליך${RUN_ID}`,
  });
});

test.afterAll(async () => {
  await service.from("notifications").delete().eq("related_id", cardId);
  if (cardId) await service.from("students").delete().eq("id", cardId);
});

test("שדכן שאינו מנהל הכרטיס אינו יכול לסמן, ואין לו כפתור", async ({
  page,
}) => {
  // Arrange - משתמש הבדיקה הוא שדכן, והכרטיס של מנהל כרטיסים אחר
  const shadchanId = await getTestUserId(service);
  expect(shadchanId).not.toBe(managerId);
  const { data: user } = await service.auth.admin.getUserById(shadchanId);
  const shadchan = await clientAs(service, user.user!.email!);

  // Act
  const { error } = await shadchan.rpc("set_card_matchmaking_hold", {
    p_student_id: cardId,
    p_on: true,
    p_reason: null,
  });

  // Assert
  expect(error?.message).toContain("not_allowed");
  await page.goto(`/app/students/${cardId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(
    page.getByRole("button", { name: 'סימון "בתהליך שידוך"' }),
  ).toHaveCount(0);
});

test("סימון של ההנהלה: התראה למנהל הכרטיס וכוכב בצבע שונה ברשימה", async ({
  page,
}) => {
  // Arrange
  const adminClient = await clientAs(service, ADMIN_EMAIL);

  // Act
  const { error } = await adminClient.rpc("set_card_matchmaking_hold", {
    p_student_id: cardId,
    p_on: true,
    p_reason: "נפגשים כעת",
  });

  // Assert - התראה למנהל הכרטיס
  expect(error).toBeNull();
  const { data: notices } = await service
    .from("notifications")
    .select("title, body, user_id")
    .eq("related_id", cardId)
    .eq("type", "card_updated");
  expect(notices).toHaveLength(1);
  expect(notices![0].user_id).toBe(managerId);
  expect(notices![0].title).toBe('הכרטיס סומן "בתהליך שידוך"');
  expect(notices![0].body).toContain("נפגשים כעת");

  // Assert - ברשימה (משתמש הבדיקה הוא שדכן) הכוכב מסומן "בתהליך"
  await page.goto("/app/students");
  await page.locator("#search").fill(`תהליך${RUN_ID}`);
  const star = page
    .getByRole("table", { name: "רשימת המיועדים" })
    .locator("button[data-on-hold]");
  await expect(star).toHaveCount(1, { timeout: LOAD_TIMEOUT });
  await expect(star).toHaveAttribute("title", /בתהליך שידוך.*נפגשים כעת/);
});

test("מנהל הכרטיס אינו יכול להסיר סימון של ההנהלה, וסימון עצמי אינו שולח התראה", async () => {
  // Arrange
  const manager = await clientAs(service, CARD_MANAGER_EMAIL);

  // Act + Assert - הסרת סימון של ההנהלה נחסמת
  const blocked = await manager.rpc("set_card_matchmaking_hold", {
    p_student_id: cardId,
    p_on: false,
  });
  expect(blocked.error?.message).toContain("hold_set_by_admin");

  // Arrange - ההנהלה מסירה, ומנהל הכרטיס מסמן בעצמו
  const adminClient = await clientAs(service, ADMIN_EMAIL);
  await adminClient.rpc("set_card_matchmaking_hold", {
    p_student_id: cardId,
    p_on: false,
  });
  await service.from("notifications").delete().eq("related_id", cardId);

  // Act
  const own = await manager.rpc("set_card_matchmaking_hold", {
    p_student_id: cardId,
    p_on: true,
    p_reason: null,
  });

  // Assert
  expect(own.error).toBeNull();
  const { count } = await service
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("related_id", cardId);
  expect(count).toBe(0);
});
