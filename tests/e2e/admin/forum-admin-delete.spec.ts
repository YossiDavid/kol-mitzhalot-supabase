/**
 * Callers: Playwright `chromium-admin` project (משתמש הבדיקה הוא מנהל).
 * API: DELETE /api/v1/forum/posts/[id], DELETE /api/v1/forum/replies/[id]
 *      ← forum_posts / forum_replies / forum_likes (RLS: כותב התוכן או מנהל).
 * User: "צריך להוסיף אפשרות למחוק פוסטים מהפורום" — מנהל מוחק תוכן של אחרים.
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  countForumRows,
  createApprovedMatchmaker,
  createServiceClient,
  seedPost,
  type OtherMatchmaker,
} from "../forums/forum-fixtures";

const RUN_ID = Date.now();
const TITLE_PREFIX = `מנהל מוחק ${RUN_ID}`;

test.describe("מנהל מוחק תוכן של שדכנים בפורום", () => {
  test.describe.configure({ mode: "serial" });

  let service: SupabaseClient;
  let author: OtherMatchmaker;

  test.beforeAll(async () => {
    service = createServiceClient();
    author = await createApprovedMatchmaker(service, RUN_ID);
  });

  test.afterAll(async () => {
    await service
      .from("forum_posts")
      .delete()
      .like("title", `${TITLE_PREFIX}%`);
    await service.auth.admin.deleteUser(author.id);
  });

  test("מנהל מוחק פוסט של שדכן אחר, והוא נעלם מהרשימה עם התגובות והלייקים", async ({
    page,
  }) => {
    // Arrange
    const title = `${TITLE_PREFIX} post`;
    const { postId, replyIds } = await seedPost(service, {
      authorId: author.id,
      title,
      replies: [
        { authorId: author.id, content: "תגובה א" },
        { authorId: author.id, content: "תגובה ב" },
      ],
      likerIds: [author.id],
    });
    await page.goto("/app/forums");
    const card = page.getByTestId("forum-post").filter({ hasText: title });
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Act — מחיקה מתפריט הרשימה
    await card.getByRole("button", { name: "מחיקת הפוסט" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("2 תגובות");
    await dialog.getByRole("button", { name: "מחיקת הפוסט" }).click();

    // Assert — ממתינים לסגירת הדיאלוג: כל עוד הוא פתוח הרשימה מוסתרת
    // מעץ הנגישות, ו-getByRole היה מדווח "0" גם בלי שהפוסט נמחק
    await expect(dialog).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("link", { name: title })).toHaveCount(0, {
      timeout: 15_000,
    });
    expect(await countForumRows(service, postId, replyIds)).toEqual({
      posts: 0,
      replies: 0,
      likes: 0,
    });
  });

  test("מנהל מוחק פוסט מעמוד הפוסט וחוזר לרשימה", async ({ page }) => {
    // Arrange
    const title = `${TITLE_PREFIX} page`;
    const { postId, replyIds } = await seedPost(service, {
      authorId: author.id,
      title,
      replies: [{ authorId: author.id, content: "תגובה" }],
      likerIds: [author.id],
    });
    await page.goto(`/app/forums/${postId}`);

    // Act
    await page.getByRole("button", { name: "מחיקת הפוסט" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "מחיקת הפוסט" })
      .click();

    // Assert
    await expect(page).toHaveURL(/\/app\/forums$/, { timeout: 15_000 });
    expect(await countForumRows(service, postId, replyIds)).toEqual({
      posts: 0,
      replies: 0,
      likes: 0,
    });
  });

  test("מנהל מוחק תגובה פוגענית של שדכן אחר, והפוסט נשאר", async ({ page }) => {
    // Arrange
    const { postId, replyIds } = await seedPost(service, {
      authorId: author.id,
      title: `${TITLE_PREFIX} reply`,
      replies: [
        { authorId: author.id, content: "תגובה פוגענית" },
        { authorId: author.id, content: "תגובה תקינה" },
      ],
      likerIds: [author.id],
    });
    await page.goto(`/app/forums/${postId}`);
    const replies = page.getByTestId("forum-reply");
    await expect(replies).toHaveCount(2);

    // Act
    await replies
      .filter({ hasText: "תגובה פוגענית" })
      .getByRole("button", { name: "מחיקת התגובה" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "מחיקת התגובה" })
      .click();

    // Assert
    await expect(replies).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByText("תגובה תקינה")).toBeVisible();
    const counts = await countForumRows(service, postId, replyIds);
    expect(counts.posts).toBe(1);
    expect(counts.replies).toBe(1);
  });
});
