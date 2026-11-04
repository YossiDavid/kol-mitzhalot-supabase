import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { CARD_MANAGER_EMAIL } from "../chats/context-fixtures";
import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";
import {
  createTestUser,
  deleteTestUserByEmail,
} from "../auth-forms/auth-test-helpers";

/**
 * התחזות (מנהל נכנס כמשתמש): נרשמת ביומן הפעילות, לא אפשרית כלפי מנהל אחר,
 * ונחסמת בבקשה שאינה מדף האתר.
 */
const ENDPOINT = "/api/v1/admin/impersonate";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const SAME_ORIGIN = { Origin: BASE_URL };

let svc: SupabaseClient;
let targetId = "";
let otherAdminId = "";
let otherAdminEmail = "";

test.describe("התחזות למשתמש", () => {
  test.beforeAll(async () => {
    svc = createServiceClient();
    targetId = await getTestUserId(svc, CARD_MANAGER_EMAIL);
    const other = await createTestUser();
    otherAdminId = other.id;
    otherAdminEmail = other.email;
    const { error } = await svc.auth.admin.updateUserById(otherAdminId, {
      app_metadata: { roles: ["admin"] },
    });
    if (error) throw new Error(error.message);
  });

  test.afterAll(async () => {
    if (otherAdminEmail) await deleteTestUserByEmail(otherAdminEmail);
  });

  test("מנהל נכנס כמשתמש רגיל, והכניסה נרשמת ביומן", async ({ request }) => {
    // Act
    const response = await request.post(ENDPOINT, {
      headers: SAME_ORIGIN,
      data: { userId: targetId },
    });

    // Assert
    expect(response.status(), await response.text()).toBe(200);
    expect((await response.json()).redirectUrl).toContain("/auth/confirm");
    const { data } = await svc
      .from("activity_log")
      .select("action")
      .eq("entity_id", targetId)
      .eq("action", "user.impersonate");
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  test("אין התחזות למנהל אחר", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: SAME_ORIGIN,
      data: { userId: otherAdminId },
    });
    expect(response.status()).toBe(403);
  });

  test("בקשה שאינה מדף האתר נחסמת", async ({ request }) => {
    const response = await request.post(ENDPOINT, {
      headers: { Origin: "https://evil.example" },
      data: { userId: targetId },
    });
    expect(response.status()).toBe(403);
  });
});
