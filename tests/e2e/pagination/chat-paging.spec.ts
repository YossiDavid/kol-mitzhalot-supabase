import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  deleteRoomsAmong,
  ensureSecondParentId,
  sendAs,
} from "../chats/context-fixtures";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * טעינת הודעות בעמודים בצ'אט: 120 הודעות בחדר. נטענות 50 האחרונות, ו-"טעינת
 * הודעות קודמות" מוסיפה 50 בכל לחיצה עד שנגמר ההיסטוריה (50 + 50 + 20).
 */
const MESSAGE_COUNT = 120;
const PAGE_SIZE = 50;
const LOAD_TIMEOUT = 15_000;
const SECOND_MS = 1000;
const LOAD_OLDER_NAME = "טעינת הודעות קודמות";

test.describe.configure({ mode: "serial" });

let admin: SupabaseClient;
let testUserId: string;
let otherUserId: string;
let roomId: string;

const label = (index: number) => `הודעה ${String(index).padStart(3, "0")}`;
const log = (page: Page) => page.getByRole("log", { name: "הודעות" });
const loadOlder = (page: Page) =>
  page.getByRole("button", { name: LOAD_OLDER_NAME });

test.beforeAll(async () => {
  admin = createServiceClient();
  testUserId = await getTestUserId(admin);
  otherUserId = await ensureSecondParentId(admin);
  await deleteRoomsAmong(admin, [testUserId, otherUserId]);

  const [userA, userB] = [testUserId, otherUserId].sort();
  const { data, error } = await admin
    .from("chat_rooms")
    .insert({ user_a: userA, user_b: userB, created_by: testUserId })
    .select("room_id")
    .single();
  if (error || !data) throw new Error(`יצירת חדר נכשלה: ${error?.message}`);
  roomId = data.room_id as string;
  await admin.from("chat_room_participants").insert([
    { room_id: roomId, user_id: testUserId },
    { room_id: roomId, user_id: otherUserId },
  ]);

  const base = Date.now() - 2 * MESSAGE_COUNT * SECOND_MS;
  const { error: messagesError } = await admin.from("chat_messages").insert(
    Array.from({ length: MESSAGE_COUNT }, (_, index) => ({
      room_id: roomId,
      sender_id: index % 2 === 0 ? otherUserId : testUserId,
      content: label(index),
      created_at: new Date(base + index * SECOND_MS).toISOString(),
    })),
  );
  if (messagesError) {
    throw new Error(`יצירת הודעות נכשלה: ${messagesError.message}`);
  }
});

test.afterAll(async () => {
  await deleteRoomsAmong(admin, [testUserId, otherUserId]);
});

test("נטענות 50 ההודעות האחרונות בלבד, עם כפתור להודעות קודמות", async ({
  page,
}) => {
  await page.goto(`/app/chats/${roomId}`);

  await expect(log(page).getByText(label(MESSAGE_COUNT - 1))).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect(
    log(page).getByText(label(MESSAGE_COUNT - PAGE_SIZE)),
  ).toHaveCount(1);
  await expect(
    log(page).getByText(label(MESSAGE_COUNT - PAGE_SIZE - 1)),
  ).toHaveCount(0);
  await expect(loadOlder(page)).toBeVisible();
});

test("שתי לחיצות טוענות 50 ועוד 20, הכפתור נעלם וההודעה הראשונה נגישה", async ({
  page,
}) => {
  await page.goto(`/app/chats/${roomId}`);
  await expect(loadOlder(page)).toBeVisible({ timeout: LOAD_TIMEOUT });

  await loadOlder(page).click();
  await expect(
    log(page).getByText(label(MESSAGE_COUNT - 2 * PAGE_SIZE)),
  ).toHaveCount(1, { timeout: LOAD_TIMEOUT });
  await expect(loadOlder(page)).toBeVisible();

  await loadOlder(page).click();
  await expect(log(page).getByText(label(0))).toHaveCount(1, {
    timeout: LOAD_TIMEOUT,
  });
  await expect(loadOlder(page)).toHaveCount(0);
  // בלי כפילויות: כל 120 ההודעות מופיעות פעם אחת
  await expect(log(page).getByText(/^הודעה \d{3}$/)).toHaveCount(MESSAGE_COUNT);
});

test("הודעה חדשה אחרי טעינת ישנות מופיעה פעם אחת בתחתית", async ({ page }) => {
  await page.goto(`/app/chats/${roomId}`);
  await expect(loadOlder(page)).toBeVisible({ timeout: LOAD_TIMEOUT });
  await loadOlder(page).click();
  await expect(
    log(page).getByText(label(MESSAGE_COUNT - 2 * PAGE_SIZE)),
  ).toHaveCount(1, { timeout: LOAD_TIMEOUT });

  const fresh = `הודעה חדשה ${Date.now()}`;
  await sendAs(admin, roomId, otherUserId, fresh);

  await expect(log(page).getByText(fresh)).toHaveCount(1, {
    timeout: LOAD_TIMEOUT,
  });
  const texts = await log(page)
    .getByText(/^הודעה /)
    .allInnerTexts();
  expect(texts.at(-1)).toBe(fresh);
});

test("טעינת ישנות שומרת את מקום הקריאה", async ({ page }) => {
  await page.goto(`/app/chats/${roomId}`);
  await expect(loadOlder(page)).toBeVisible({ timeout: LOAD_TIMEOUT });
  // הישנה שבין הנטענות (הבדיקה הקודמת הוסיפה הודעה, ולכן אינה קבועה)
  const first = log(page)
    .getByText(/^הודעה \d{3}$/)
    .first();
  const anchorText = (await first.innerText()).trim();
  const anchor = log(page).getByText(anchorText, { exact: true });
  await anchor.scrollIntoViewIfNeeded();
  const before = (await anchor.boundingBox())!.y;

  await loadOlder(page).click();
  await expect
    .poll(
      () =>
        log(page)
          .getByText(/^הודעה \d{3}$/)
          .count(),
      {
        timeout: LOAD_TIMEOUT,
      },
    )
    .toBeGreaterThan(PAGE_SIZE);

  // ההודעה שנקראה נשארת באותו מקום במסך (סטייה קטנה בלבד), ולא קופצת
  await expect
    .poll(async () => Math.abs((await anchor.boundingBox())!.y - before))
    .toBeLessThan(40);
});
