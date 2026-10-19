import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient, getTestUserId } from "../shidduchim/fixtures";

/**
 * הפעמון מציג רק התראות שלא נקראו: בפתיחה הן מסומנות כנקראו ונשארות גלויות
 * כל עוד הפופאובר פתוח, ובסגירה הן יורדות מהרשימה. התראה חדשה (Realtime)
 * נכנסת לרשימה.
 */
const T = `${Date.now()}`.slice(-8);
const UNREAD_TITLE = `התראה-לא-נקראה-${T}`;
const READ_TITLE = `התראה-שנקראה-${T}`;
const LIVE_TITLE = `התראה-בזמן-אמת-${T}`;
const REALTIME_TIMEOUT_MS = 15_000;

let svc: SupabaseClient;
let userId: string;

async function insertNotification(title: string, readAt: string | null) {
  const { error } = await svc.from("notifications").insert({
    user_id: userId,
    type: "chat_message",
    title,
    body: null,
    link: null,
    read_at: readAt,
  });
  if (error) throw new Error(`הכנת התראה נכשלה: ${error.message}`);
}

function bell(page: Page) {
  return page.getByRole("button", { name: /^התראות/ });
}

function popover(page: Page) {
  return page.getByRole("dialog");
}

test.describe("פעמון ההתראות - רק התראות שלא נקראו", () => {
  test.beforeAll(async () => {
    svc = createServiceClient();
    userId = await getTestUserId(svc);
  });

  test.beforeEach(async () => {
    // מצב התחלתי צפוי: כל ההתראות הקודמות של משתמש הבדיקה נקראו
    await svc
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
  });

  test.afterAll(async () => {
    await svc
      .from("notifications")
      .delete()
      .eq("user_id", userId)
      .like("title", `%-${T}`);
  });

  test("נקראות נעלמות בסגירה, ונשארות גלויות כל עוד הפופאובר פתוח", async ({
    page,
  }) => {
    // Arrange
    await insertNotification(UNREAD_TITLE, null);
    await insertNotification(READ_TITLE, new Date().toISOString());

    // Act
    await page.goto("/app");
    await expect(bell(page)).toHaveAttribute("aria-label", "התראות, 1 חדשות");
    await bell(page).click();

    // Assert - רק שלא נקראה; היא נשארת גלויה גם אחרי הסימון
    await expect(popover(page).getByText(UNREAD_TITLE)).toBeVisible();
    await expect(popover(page).getByText(READ_TITLE)).toHaveCount(0);
    await expect
      .poll(async () => {
        const { data } = await svc
          .from("notifications")
          .select("read_at")
          .eq("user_id", userId)
          .eq("title", UNREAD_TITLE)
          .single();
        return data?.read_at ?? null;
      })
      .not.toBeNull();
    await expect(popover(page).getByText(UNREAD_TITLE)).toBeVisible();

    // Act - סגירה ופתיחה מחדש
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    await bell(page).click();

    // Assert
    await expect(popover(page).getByText(UNREAD_TITLE)).toHaveCount(0);
    await expect(popover(page).getByText("אין התראות חדשות")).toBeVisible();

    // Act - טעינה מחדש: גם מהשרת נטענות רק שלא נקראו
    await page.reload();
    await bell(page).click();
    await expect(popover(page).getByText("אין התראות חדשות")).toBeVisible();
  });

  test("התראה חדשה ב-Realtime נכנסת לרשימה", async ({ page }) => {
    // Arrange
    await page.goto("/app");
    await expect(bell(page)).toHaveAttribute("aria-label", "התראות");
    // הערוץ נרשם אחרי הטעינה; נותנים לו לעלות לפני הכתיבה
    await page.waitForLoadState("networkidle");

    // Act
    await insertNotification(LIVE_TITLE, null);

    // Assert
    await expect(bell(page)).toHaveAttribute("aria-label", "התראות, 1 חדשות", {
      timeout: REALTIME_TIMEOUT_MS,
    });
    await bell(page).click();
    await expect(popover(page).getByText(LIVE_TITLE)).toBeVisible();
  });
});
