import { test, expect } from "@playwright/test";

import {
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

/**
 * בצ'אט מוצג שם הצד השני ולא תחילת ה-uid - גם כשאין לו שורה ב-user_profiles
 * (get_user_metadata נופל לשם שב-auth.users). ומי שאינו מחובר לא מקבל שם
 * ואימייל של משתמשים.
 */
const OTHER_USER_NAME = "Fixture Manager";

const admin = createServiceClient();
let roomId: string;
let otherUserId: string;
let savedProfile: Record<string, unknown> | null = null;

test.beforeAll(async () => {
  const testUserId = await getTestUserId(admin);
  otherUserId = await ensureCardManagerId(admin);

  // משחזרים את התקלה: לצד השני אין שורה ב-user_profiles
  const { data: profile } = await admin
    .from("user_profiles")
    .select("*")
    .eq("id", otherUserId)
    .maybeSingle();
  savedProfile = profile;
  await admin.from("user_profiles").delete().eq("id", otherUserId);

  const [userA, userB] = [testUserId, otherUserId].sort();
  const { data: existing } = await admin
    .from("chat_rooms")
    .select("room_id")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();
  if (existing) {
    await admin.from("chat_rooms").delete().eq("room_id", existing.room_id);
  }

  const { data: room, error } = await admin
    .from("chat_rooms")
    .insert({ user_a: userA, user_b: userB, created_by: testUserId })
    .select("room_id")
    .single();
  if (error || !room) {
    throw new Error(`יצירת שיחת הבדיקה נכשלה: ${error?.message}`);
  }
  roomId = room.room_id as string;

  const { error: participantsError } = await admin
    .from("chat_room_participants")
    .insert([
      { room_id: roomId, user_id: testUserId },
      { room_id: roomId, user_id: otherUserId },
    ]);
  if (participantsError) {
    throw new Error(`הוספת משתתפי השיחה נכשלה: ${participantsError.message}`);
  }
});

test.afterAll(async () => {
  if (roomId) await admin.from("chat_rooms").delete().eq("room_id", roomId);
  if (savedProfile) {
    await admin.from("user_profiles").upsert(savedProfile);
  }
});

test("רשימת הצ'אטים מציגה את שם הצד השני, לא את ה-uid", async ({ page }) => {
  // Act
  await page.goto("/app/chats");

  // Assert
  await expect(page.getByText(OTHER_USER_NAME).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(otherUserId.substring(0, 8))).toHaveCount(0);
});

test("get_user_metadata לא מחזיר נתונים למי שאינו מחובר", async ({
  request,
}) => {
  // Arrange
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) throw new Error("חסרים משתני Supabase לבדיקה");

  // Act
  const response = await request.post(`${url}/rest/v1/rpc/get_user_metadata`, {
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    data: { target_user_id: otherUserId },
  });

  // Assert
  const body = await response.text();
  expect(body).not.toContain(OTHER_USER_NAME);
  expect(body).not.toContain("@kol-mitzhalot.test");
});
