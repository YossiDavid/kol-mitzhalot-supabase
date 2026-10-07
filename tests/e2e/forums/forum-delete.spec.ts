/**
 * Callers: Playwright `chromium` project (משתמש הבדיקה הוא שדכן מאושר).
 * API: DELETE /api/v1/forum/posts/[id], DELETE /api/v1/forum/replies/[id]
 *      ← forum_posts / forum_replies / forum_likes (RLS: כותב התוכן או מנהל).
 * User: "צריך להוסיף אפשרות למחוק פוסטים מהפורום".
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getTestUserId } from "../shidduchim/fixtures";
import {
  countForumRows,
  createApprovedMatchmaker,
  createServiceClient,
  createUserSessionClient,
  seedPost,
  setShadchanApproval,
  type OtherMatchmaker,
} from "./forum-fixtures";

const RUN_ID = Date.now();
const TITLE_PREFIX = `מחיקת פוסט ${RUN_ID}`;
const TEST_USER_EMAIL =
  process.env.TEST_USER_EMAIL ?? "playwright-test@kol-mitzhalot.test";

test.describe("מחיקת פוסטים ותגובות בפורום", () => {
  test.describe.configure({ mode: "serial" });

  let service: SupabaseClient;
  let userId = "";
  let other: OtherMatchmaker;

  test.beforeAll(async () => {
    service = createServiceClient();
    userId = await getTestUserId(service);
    await setShadchanApproval(service, userId, "approved");
    other = await createApprovedMatchmaker(service, RUN_ID);
  });

  test.afterAll(async () => {
    await service
      .from("forum_posts")
      .delete()
      .like("title", `${TITLE_PREFIX}%`);
    await service.auth.admin.deleteUser(other.id);
    await service.from("shadchanim_info").delete().eq("user_id", userId);
  });

  test("הכותב מוחק את הפוסט שלו: התגובות והלייקים נעלמים וחוזרים לרשימה", async ({
    page,
  }) => {
    // Arrange
    const title = `${TITLE_PREFIX} own`;
    const { postId, replyIds } = await seedPost(service, {
      authorId: userId,
      title,
      replies: [
        { authorId: other.id, content: "תגובה ראשונה" },
        { authorId: userId, content: "תגובה שנייה" },
      ],
      likerIds: [userId, other.id],
    });
    expect(await countForumRows(service, postId, replyIds)).toEqual({
      posts: 1,
      replies: 2,
      likes: 4,
    });
    await page.goto(`/app/forums/${postId}`);

    // Act
    await page.getByRole("button", { name: "מחיקת הפוסט" }).click();

    // Assert — הדיאלוג מפרט מה יימחק
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("הפוסט וכל התגובות אליו יימחקו");
    await expect(dialog).toContainText("2 תגובות");

    // Act
    await dialog.getByRole("button", { name: "מחיקת הפוסט" }).click();

    // Assert
    await expect(page).toHaveURL(/\/app\/forums$/, { timeout: 15_000 });
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
    expect(await countForumRows(service, postId, replyIds)).toEqual({
      posts: 0,
      replies: 0,
      likes: 0,
    });
  });

  test("ביטול בדיאלוג לא מוחק דבר", async ({ page }) => {
    // Arrange
    const { postId, replyIds } = await seedPost(service, {
      authorId: userId,
      title: `${TITLE_PREFIX} cancel`,
      replies: [{ authorId: other.id, content: "תגובה שנשארת" }],
      likerIds: [other.id],
    });
    await page.goto(`/app/forums/${postId}`);

    // Act
    await page.getByRole("button", { name: "מחיקת הפוסט" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "ביטול" })
      .click();

    // Assert
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/app/forums/${postId}$`));
    expect(await countForumRows(service, postId, replyIds)).toEqual({
      posts: 1,
      replies: 1,
      likes: 2,
    });
  });

  test("הכותב מוחק את התגובה שלו בלבד, ובתגובה של אחר אין כפתור מחיקה", async ({
    page,
  }) => {
    // Arrange
    const { postId, replyIds } = await seedPost(service, {
      authorId: other.id,
      title: `${TITLE_PREFIX} reply`,
      replies: [
        { authorId: userId, content: "התגובה שלי למחיקה" },
        { authorId: other.id, content: "התגובה של האחר" },
      ],
      likerIds: [other.id],
    });
    await page.goto(`/app/forums/${postId}`);
    const replies = page.getByTestId("forum-reply");
    await expect(replies).toHaveCount(2);

    // Assert — כפתור מחיקה רק בתגובה שלי, ובפוסט של אחר אין כפתור
    await expect(page.getByRole("button", { name: "מחיקת הפוסט" })).toHaveCount(
      0,
    );
    await expect(
      replies.filter({ hasText: "התגובה של האחר" }).getByRole("button", {
        name: "מחיקת התגובה",
      }),
    ).toHaveCount(0);

    // Act
    await replies
      .filter({ hasText: "התגובה שלי למחיקה" })
      .getByRole("button", { name: "מחיקת התגובה" })
      .click();
    await expect(page.getByRole("dialog")).toContainText("התגובה תימחק");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "מחיקת התגובה" })
      .click();

    // Assert — נעלמה במקום, ושאר הפוסט לא נפגע
    await expect(replies).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByText("התגובה שלי למחיקה")).toHaveCount(0);
    await expect(page.getByText("התגובה של האחר")).toBeVisible();
    const { data: remaining } = await service
      .from("forum_replies")
      .select("id")
      .eq("post_id", postId);
    expect(remaining).toHaveLength(1);
    expect(replyIds).toContain(remaining![0].id);
  });

  test("שדכן מאושר אחר לא רואה כפתור, ה-API מחזיר 404 וגם מחיקה ישירה במסד נחסמת", async ({
    page,
  }) => {
    // Arrange — פוסט ותגובה של שדכן אחר
    const { postId, replyIds } = await seedPost(service, {
      authorId: other.id,
      title: `${TITLE_PREFIX} foreign`,
      replies: [{ authorId: other.id, content: "תגובה של האחר" }],
      likerIds: [other.id],
    });
    await page.goto(`/app/forums/${postId}`);
    await expect(page.getByTestId("forum-reply")).toHaveCount(1);
    await page.goto("/app/forums");

    // Assert — אין כפתור מחיקה בכרטיס ברשימה
    const card = page
      .getByTestId("forum-post")
      .filter({ hasText: `${TITLE_PREFIX} foreign` });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "מחיקת הפוסט" })).toHaveCount(
      0,
    );

    // Act — בקשות DELETE ישירות עם הסשן של משתמש הבדיקה
    const postResponse = await page.request.delete(
      `/api/v1/forum/posts/${postId}`,
    );
    const replyResponse = await page.request.delete(
      `/api/v1/forum/replies/${replyIds[0]}`,
    );
    const badIdResponse = await page.request.delete(
      "/api/v1/forum/posts/not-a-uuid",
    );

    // Assert
    expect(postResponse.status()).toBe(404);
    expect(replyResponse.status()).toBe(404);
    expect(badIdResponse.status()).toBe(400);

    // Act — מחיקה ישירה בטבלה עם הסשן של אותו משתמש (RLS בלבד)
    const session = await createUserSessionClient(service, TEST_USER_EMAIL);
    const directPost = await session
      .from("forum_posts")
      .delete()
      .eq("id", postId)
      .select("id");
    const directReply = await session
      .from("forum_replies")
      .delete()
      .eq("id", replyIds[0])
      .select("id");

    // Assert
    expect(directPost.error).toBeNull();
    expect(directPost.data).toHaveLength(0);
    expect(directReply.error).toBeNull();
    expect(directReply.data).toHaveLength(0);
    expect(await countForumRows(service, postId, replyIds)).toEqual({
      posts: 1,
      replies: 1,
      likes: 2,
    });
  });
});
