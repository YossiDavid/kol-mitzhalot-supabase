import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CARD_MANAGER_EMAIL,
  clientAs,
  deleteRoomsAmong,
  ensureSecondParentId,
  openRoomAs,
} from "./context-fixtures";
import {
  TEST_USER_EMAIL,
  createServiceClient,
  ensureCardManagerId,
  getTestUserId,
} from "../shidduchim/fixtures";

/**
 * get_users_metadata: אותו כלל כמו get_user_metadata, לכמה משתמשים בבת אחת.
 * הורה מקבל את שם מי שיש איתו שיחה, ולא של משתמש זר; אימייל רק לעצמו.
 */
type MetadataRow = { user_id: string; metadata: Record<string, unknown> };

let admin: SupabaseClient;
let parentId = "";
let shadchanId = "";
let strangerId = "";

test.describe("שמות הצד השני בקריאה אחת", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    admin = createServiceClient();
    parentId = await ensureCardManagerId(admin);
    shadchanId = await getTestUserId(admin);
    strangerId = await ensureSecondParentId(admin);
    await deleteRoomsAmong(admin, [parentId, shadchanId, strangerId]);
    const shadchan = await clientAs(admin, TEST_USER_EMAIL);
    const opened = await openRoomAs(shadchan, parentId, { kind: "general" });
    expect(opened.error).toBeNull();
  });

  test.afterAll(async () => {
    await deleteRoomsAmong(admin, [parentId, shadchanId, strangerId]);
  });

  test("הורה: בן השיחה ועצמו חוזרים, משתמש זר לא", async () => {
    // Arrange
    const parent = await clientAs(admin, CARD_MANAGER_EMAIL);

    // Act
    const { data, error } = await parent.rpc("get_users_metadata", {
      target_user_ids: [shadchanId, strangerId, parentId],
    });

    // Assert
    expect(error).toBeNull();
    const rows = (data ?? []) as MetadataRow[];
    const byId = new Map(rows.map((row) => [row.user_id, row.metadata]));
    expect([...byId.keys()].sort()).toEqual([parentId, shadchanId].sort());
    expect(byId.get(shadchanId)?.email ?? null).toBeNull();
    expect(byId.get(parentId)?.email).toBeTruthy();
  });

  test("גולש לא מחובר אינו מריץ את הפונקציה", async () => {
    // Act: המפתח הציבורי בלבד, בלי סשן
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_users_metadata`,
      {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target_user_ids: [shadchanId] }),
      },
    );

    // Assert
    expect(response.ok).toBe(false);
  });
});
