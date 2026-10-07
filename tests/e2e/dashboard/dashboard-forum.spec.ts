/**
 * Callers: Playwright `chromium` project (משתמש הבדיקה הוא שדכן מאושר).
 * Data: forum_posts (נשלף בדשבורד ב-getLatestForumPosts).
 * Bug: השליפה ביקשה עמודה בשם body (העמודה היא content), השגיאה נבלעה, והמקטע
 * הציג תמיד "עדיין אין הודעות בפורום".
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getTestUserId } from "../shidduchim/fixtures";
import {
  createServiceClient,
  seedPost,
  setShadchanApproval,
} from "../forums/forum-fixtures";

const RUN_ID = Date.now();
const TITLE = `דשבורד פורום ${RUN_ID}`;
const LOAD_TIMEOUT = 15_000;

test.describe("דשבורד: מקטע הפורומים", () => {
  let service: SupabaseClient;
  let userId = "";
  let postId = "";

  test.beforeAll(async () => {
    service = createServiceClient();
    userId = await getTestUserId(service);
    await setShadchanApproval(service, userId, "approved");
    ({ postId } = await seedPost(service, {
      authorId: userId,
      title: TITLE,
      replies: [],
      likerIds: [userId],
    }));
  });

  test.afterAll(async () => {
    await service.from("forum_posts").delete().eq("id", postId);
    await service.from("shadchanim_info").delete().eq("user_id", userId);
  });

  test("הפוסט האחרון מוצג עם הכותרת והתקציר, וקישור לדף הפוסט", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/app");

    // Act
    const postLink = page.locator(`a[href="/app/forums/${postId}"]`);

    // Assert
    await expect(postLink).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(postLink).toContainText(TITLE);
    await expect(postLink).toContainText("תוכן לבדיקת מחיקה");
    await expect(page.getByText("עדיין אין הודעות בפורום השדכנים")).toHaveCount(
      0,
    );
    await expect(page.getByText("לא הצלחנו לטעון את הפורום")).toHaveCount(0);

    // Act
    await postLink.click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`/app/forums/${postId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  });
});
