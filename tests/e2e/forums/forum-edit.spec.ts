/**
 * Callers: Playwright `chromium` project (משתמש הבדיקה הוא שדכן מאושר).
 * API: PATCH /api/v1/forum/posts/[id], PATCH /api/v1/forum/replies/[id]
 *      ← forum_posts / forum_replies (RLS UPDATE: הכותב בלבד).
 * User: "לעשות אפשרות לערוך בפוסט בפורום שדכנים."
 */
import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getTestUserId } from "../shidduchim/fixtures";
import {
  createApprovedMatchmaker,
  createServiceClient,
  createUserSessionClient,
  seedPost,
  setShadchanApproval,
  type OtherMatchmaker,
} from "./forum-fixtures";

const RUN_ID = Date.now();
const TITLE_PREFIX = `עריכת פוסט ${RUN_ID}`;
const LOAD_TIMEOUT = 15_000;
const ADMIN_EMAIL =
  process.env.TEST_ADMIN_EMAIL ?? "playwright-admin@kol-mitzhalot.test";
const EDITED_MARKER = "forum-edited";
const FORGED_AUTHOR = "00000000-0000-4000-8000-0000000000aa";

test.describe("עריכת פוסטים ותגובות בפורום", () => {
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

  const postRow = async (id: string) =>
    (
      await service
        .from("forum_posts")
        .select("title, content, author_id, is_pinned, edited_at, category_id")
        .eq("id", id)
        .single()
    ).data;

  test("הכותב עורך את הפוסט שלו בדיאלוג: נשמר, מסומן 'נערך', ואין סימון לפני", async ({
    page,
  }) => {
    // Arrange
    const title = `${TITLE_PREFIX} own`;
    const { postId } = await seedPost(service, {
      authorId: userId,
      title,
      replies: [],
      likerIds: [userId],
    });
    await page.goto(`/app/forums/${postId}`);
    await expect(page.getByTestId(EDITED_MARKER)).toHaveCount(0);

    // Act
    await page.getByRole("button", { name: "עריכת הפוסט" }).click();
    const dialog = page.getByRole("dialog", { name: "עריכת פוסט" });
    await expect(dialog.getByLabel("כותרת")).toHaveValue(title);
    await expect(dialog.getByRole("button", { name: "שמירה" })).toBeDisabled();
    const newTitle = `${TITLE_PREFIX} own edited`;
    await dialog.getByLabel("כותרת").fill(newTitle);
    await dialog.getByLabel("תוכן").fill("תוכן אחרי עריכה");
    await dialog.getByRole("button", { name: "שמירה" }).click();

    // Assert - הדף מתרענן במקום
    await expect(page.getByRole("dialog")).toHaveCount(0, {
      timeout: LOAD_TIMEOUT,
    });
    await expect(page.getByRole("heading", { name: newTitle })).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
    await expect(page.getByText("תוכן אחרי עריכה")).toBeVisible();
    await expect(page.getByTestId(EDITED_MARKER)).toContainText("נערך");
    const row = await postRow(postId);
    expect(row?.title).toBe(newTitle);
    expect(row?.content).toBe("תוכן אחרי עריכה");
    expect(row?.edited_at).not.toBeNull();
    expect(row?.author_id).toBe(userId);
  });

  test("הכותב עורך את התגובה שלו, ובתגובה של אחר אין כפתור עריכה", async ({
    page,
  }) => {
    // Arrange
    const { postId, replyIds } = await seedPost(service, {
      authorId: other.id,
      title: `${TITLE_PREFIX} reply`,
      replies: [
        { authorId: userId, content: "התגובה שלי לעריכה" },
        { authorId: other.id, content: "התגובה של האחר" },
      ],
      likerIds: [other.id],
    });
    await page.goto(`/app/forums/${postId}`);
    const replies = page.getByTestId("forum-reply");
    await expect(replies).toHaveCount(2);
    await expect(page.getByRole("button", { name: "עריכת הפוסט" })).toHaveCount(
      0,
    );
    await expect(
      replies
        .filter({ hasText: "התגובה של האחר" })
        .getByRole("button", { name: "עריכת התגובה" }),
    ).toHaveCount(0);

    // Act
    await replies
      .filter({ hasText: "התגובה שלי לעריכה" })
      .getByRole("button", { name: "עריכת התגובה" })
      .click();
    const dialog = page.getByRole("dialog", { name: "עריכת תגובה" });
    await dialog.getByLabel("תוכן התגובה").fill("התגובה אחרי עריכה");
    await dialog.getByRole("button", { name: "שמירה" }).click();

    // Assert
    const edited = replies.filter({ hasText: "התגובה אחרי עריכה" });
    await expect(edited).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(edited.getByTestId(EDITED_MARKER)).toContainText("נערך");
    await expect(
      replies.filter({ hasText: "התגובה של האחר" }).getByTestId(EDITED_MARKER),
    ).toHaveCount(0);
    const { data } = await service
      .from("forum_replies")
      .select("content, author_id, edited_at")
      .eq("id", replyIds[0])
      .single();
    expect(data?.content).toBe("התגובה אחרי עריכה");
    expect(data?.author_id).toBe(userId);
    expect(data?.edited_at).not.toBeNull();
  });

  test("שדות מזויפים בגוף הבקשה (author_id, is_pinned, edited_at) לא נכתבים", async ({
    page,
  }) => {
    // Arrange
    const { postId } = await seedPost(service, {
      authorId: userId,
      title: `${TITLE_PREFIX} forged`,
      replies: [],
      likerIds: [userId],
    });

    // Act
    const response = await page.request.patch(`/api/v1/forum/posts/${postId}`, {
      data: {
        title: `${TITLE_PREFIX} forged ok`,
        content: "תוכן תקין",
        author_id: FORGED_AUTHOR,
        authorId: FORGED_AUTHOR,
        is_pinned: true,
        isPinned: true,
        edited_at: "2001-01-01T00:00:00Z",
        created_at: "2001-01-01T00:00:00Z",
      },
    });

    // Assert
    expect(response.status()).toBe(200);
    const row = await postRow(postId);
    expect(row?.title).toBe(`${TITLE_PREFIX} forged ok`);
    expect(row?.author_id).toBe(userId);
    expect(row?.is_pinned).toBe(false);
    expect(new Date(row?.edited_at ?? 0).getFullYear()).toBeGreaterThan(2020);
  });

  test("שדכן אחר ומנהל לא עורכים: ללא כפתור, PATCH מחזיר 404 והתוכן לא משתנה", async ({
    page,
  }) => {
    // Arrange - פוסט ותגובה של שדכן אחר
    const { postId, replyIds } = await seedPost(service, {
      authorId: other.id,
      title: `${TITLE_PREFIX} foreign`,
      replies: [{ authorId: other.id, content: "תגובה זרה" }],
      likerIds: [other.id],
    });
    const before = await postRow(postId);

    // Act
    const postAttempt = await page.request.patch(
      `/api/v1/forum/posts/${postId}`,
      { data: { title: "חטיפה", content: "חטיפה" } },
    );
    const replyAttempt = await page.request.patch(
      `/api/v1/forum/replies/${replyIds[0]}`,
      { data: { content: "חטיפה" } },
    );
    // מנהל: מדיניות ה-UPDATE במסד אינה כוללת מנהל, ולכן לא נרחיב אותה
    const admin = await createUserSessionClient(service, ADMIN_EMAIL);
    const adminAttempt = await admin
      .from("forum_posts")
      .update({ title: "מנהל עורך" })
      .eq("id", postId)
      .select("id");

    // Assert
    expect(postAttempt.status()).toBe(404);
    expect(replyAttempt.status()).toBe(404);
    expect(adminAttempt.data ?? []).toHaveLength(0);
    expect(await postRow(postId)).toEqual(before);
    const { data: reply } = await service
      .from("forum_replies")
      .select("content, edited_at")
      .eq("id", replyIds[0])
      .single();
    expect(reply).toEqual({ content: "תגובה זרה", edited_at: null });
  });

  test("ולידציה: כותרת ריקה, תוכן ארוך מדי, JSON שבור ומזהה לא תקין", async ({
    page,
  }) => {
    // Arrange
    const { postId, replyIds } = await seedPost(service, {
      authorId: userId,
      title: `${TITLE_PREFIX} validation`,
      replies: [{ authorId: userId, content: "תגובה" }],
      likerIds: [userId],
    });
    const before = await postRow(postId);
    const post = (data: unknown) =>
      page.request.patch(`/api/v1/forum/posts/${postId}`, { data });

    // Act + Assert
    const emptyTitle = await post({ title: "  ", content: "תוכן" });
    expect(emptyTitle.status()).toBe(400);
    expect((await emptyTitle.json()).error).toBe("יש למלא כותרת ותוכן תקינים");
    expect(
      (await post({ title: "כותרת", content: "א".repeat(5001) })).status(),
    ).toBe(400);
    expect(
      (
        await post({ title: "כותרת", content: "תוכן", categoryId: "x" })
      ).status(),
    ).toBe(400);
    const badJson = await page.request.patch(`/api/v1/forum/posts/${postId}`, {
      headers: { "Content-Type": "application/json" },
      data: "{לא json",
    });
    expect(badJson.status()).toBe(400);
    expect(
      (
        await page.request.patch("/api/v1/forum/posts/not-a-guid", { data: {} })
      ).status(),
    ).toBe(400);
    const emptyReply = await page.request.patch(
      `/api/v1/forum/replies/${replyIds[0]}`,
      { data: { content: "" } },
    );
    expect(emptyReply.status()).toBe(400);
    expect((await emptyReply.json()).error).toBe("יש לכתוב תגובה");
    expect(await postRow(postId)).toEqual(before);
  });
});
