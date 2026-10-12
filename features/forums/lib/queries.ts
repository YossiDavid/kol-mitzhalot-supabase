/** Server-side reads for the shadchanim forum. RLS limits them to approved shadchanim and admins. */

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { describeZodIssues } from "@/lib/describe-zod-issues";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { fetchPageClamped, isRangeNotSatisfiable } from "@/lib/pagination";
import { FORUM_REPLIES_SAFETY_LIMIT, FORUM_POSTS_PAGE_SIZE } from "./types";
import type {
  ForumCategory,
  ForumPostDetail,
  ForumPostSummary,
  ForumReply,
} from "./types";

const FALLBACK_AUTHOR_NAME = "שדכן";

/**
 * שורות הפורום מאומתות בגבול ה-DB: ל-supabase-js אין טיפוסים שנוצרו, והוא
 * לא מסיק שורה ממחרוזת select. ה-schema הוא מקור הטיפוס, כך ששינוי שם עמודה
 * ב-POST_COLUMNS נכשל באימות (ונרשם) במקום להחזיר שדות ריקים בשקט.
 */
const countRowsSchema = z.array(z.object({ count: z.number() })).nullable();

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const postRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  author_id: z.string(),
  is_pinned: z.boolean().nullable(),
  category: categorySchema.nullable(),
  replies: countRowsSchema,
  likes: countRowsSchema,
});

const replyRowSchema = z.object({
  id: z.string(),
  content: z.string(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  author_id: z.string(),
  likes: countRowsSchema,
});

const authorNameRowSchema = z.object({
  user_id: z.string(),
  display_name: z.string().nullable(),
});

/** שורת לייקים לפי עמודה דינמית (post_id / reply_id) */
const likeRowSchema = z.record(z.string(), z.string().nullable());

type PostRow = z.infer<typeof postRowSchema>;
type CountRow = PostRow["replies"];

const POST_COLUMNS = `id, title, content, created_at, edited_at, author_id, is_pinned,
  category:forum_categories(id, name, slug),
  replies:forum_replies(count), likes:forum_likes(count)`;

const countOf = (rows: CountRow) => rows?.[0]?.count ?? 0;

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function loadAuthorNames(
  supabase: SupabaseServer,
  authorIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(authorIds)];
  if (uniqueIds.length === 0) return names;

  const { data, error } = await supabase.rpc("get_forum_author_names", {
    p_ids: uniqueIds,
  });
  if (error) {
    console.error("[forums/author-names]", describeSupabaseError(error));
    return names;
  }
  const parsed = z.array(authorNameRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[forums/author-names] unexpected rows",
      describeZodIssues(parsed.error.issues),
    );
    return names;
  }
  for (const row of parsed.data) {
    if (row.display_name) names.set(row.user_id, row.display_name);
  }
  return names;
}

async function loadMyLikes(
  supabase: SupabaseServer,
  userId: string,
  column: "post_id" | "reply_id",
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from("forum_likes")
    .select(column)
    .eq("user_id", userId)
    .in(column, ids);
  if (error) {
    console.error("[forums/my-likes]", describeSupabaseError(error));
    return new Set();
  }
  const parsed = z.array(likeRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[forums/my-likes] unexpected rows",
      describeZodIssues(parsed.error.issues),
    );
    return new Set();
  }
  return new Set(
    parsed.data.map((row) => row[column]).filter((id): id is string => !!id),
  );
}

export async function listForumCategories(): Promise<ForumCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("forum_categories")
    .select("id, name, slug")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[forums/categories]", describeSupabaseError(error));
    return [];
  }
  return data ?? [];
}

export type ForumPostsPage = {
  posts: ForumPostSummary[];
  /** כל הפוסטים בנושא (כל העמודים) */
  total: number;
  /** העמוד שהוחזר בפועל; קטן מהמבוקש כשהמבוקש היה אחרי הסוף */
  page: number;
};

/**
 * עמוד אחד של פוסטים: מוצמדים קודם, אחריהם החדשים ביותר, ובסוף id כדי שהסדר
 * יהיה יציב בין עמודים. עמוד אחרי הסוף מתכווץ לעמוד האחרון.
 * null בכשל, כדי להבדיל משגיאה ל"אין פוסטים".
 */
export async function listForumPosts(
  userId: string,
  categorySlug: string,
  requestedPage: number,
): Promise<ForumPostsPage | null> {
  const supabase = await createClient();

  let categoryId: string | null = null;
  if (categorySlug) {
    const categories = await listForumCategories();
    categoryId = categories.find((c) => c.slug === categorySlug)?.id ?? null;
    if (!categoryId) return { posts: [], total: 0, page: 1 };
  }

  const result = await fetchPageClamped(
    requestedPage,
    FORUM_POSTS_PAGE_SIZE,
    async ({ from, to }) => {
      let query = supabase
        .from("forum_posts")
        .select(POST_COLUMNS, { count: "exact" })
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      if (categoryId) query = query.eq("category_id", categoryId);

      const { data, error, count } = await query;
      if (isRangeNotSatisfiable(error)) {
        return { rows: [], total: 0, failed: false, isOutOfRange: true };
      }
      if (error) {
        console.error("[forums/posts]", describeSupabaseError(error));
        return { rows: [], total: 0, failed: true };
      }
      const parsed = z.array(postRowSchema).safeParse(data ?? []);
      if (!parsed.success) {
        console.error(
          "[forums/posts] unexpected rows",
          describeZodIssues(parsed.error.issues),
        );
        return { rows: [], total: 0, failed: true };
      }
      return { rows: parsed.data, total: count ?? 0, failed: false };
    },
  );
  if (result.failed) return null;

  const rows = result.rows;
  const [names, likedIds] = await Promise.all([
    loadAuthorNames(
      supabase,
      rows.map((row) => row.author_id),
    ),
    loadMyLikes(
      supabase,
      userId,
      "post_id",
      rows.map((row) => row.id),
    ),
  ]);

  const posts = rows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    isPinned: row.is_pinned === true,
    authorName: names.get(row.author_id) ?? FALLBACK_AUTHOR_NAME,
    category: row.category,
    replyCount: countOf(row.replies),
    likeCount: countOf(row.likes),
    isLikedByMe: likedIds.has(row.id),
  }));
  return { posts, total: result.total, page: result.page };
}

/** פוסט בודד עם התגובות שלו, או null כשאינו קיים (או שאין הרשאה לראותו) */
export async function getForumPost(
  userId: string,
  postId: string,
): Promise<ForumPostDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("forum_posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .maybeSingle();
  if (error) {
    console.error("[forums/post]", describeSupabaseError(error));
    return null;
  }
  if (!data) return null;
  const parsedPost = postRowSchema.safeParse(data);
  if (!parsedPost.success) {
    console.error(
      "[forums/post] unexpected row",
      describeZodIssues(parsedPost.error.issues),
    );
    return null;
  }
  const post = parsedPost.data;

  const { data: replyData, error: replyError } = await supabase
    .from("forum_replies")
    .select(
      "id, content, created_at, edited_at, author_id, likes:forum_likes(count)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    // תקרת בטיחות: פוסט עם מאות תגובות לא נטען כולו בבת אחת
    .limit(FORUM_REPLIES_SAFETY_LIMIT);
  if (replyError) {
    console.error("[forums/replies]", describeSupabaseError(replyError));
  }
  const parsedReplies = z.array(replyRowSchema).safeParse(replyData ?? []);
  if (!parsedReplies.success) {
    console.error(
      "[forums/replies] unexpected rows",
      describeZodIssues(parsedReplies.error.issues),
    );
  }
  const replyRows = parsedReplies.success ? parsedReplies.data : [];

  const [names, likedPosts, likedReplies] = await Promise.all([
    loadAuthorNames(supabase, [
      post.author_id,
      ...replyRows.map((r) => r.author_id),
    ]),
    loadMyLikes(supabase, userId, "post_id", [post.id]),
    loadMyLikes(
      supabase,
      userId,
      "reply_id",
      replyRows.map((r) => r.id),
    ),
  ]);

  const replies: ForumReply[] = replyRows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    authorName: names.get(row.author_id) ?? FALLBACK_AUTHOR_NAME,
    likeCount: countOf(row.likes),
    isLikedByMe: likedReplies.has(row.id),
  }));

  return {
    id: post.id,
    authorId: post.author_id,
    title: post.title,
    content: post.content,
    createdAt: post.created_at,
    editedAt: post.edited_at,
    isPinned: post.is_pinned === true,
    authorName: names.get(post.author_id) ?? FALLBACK_AUTHOR_NAME,
    category: post.category,
    replyCount: countOf(post.replies),
    likeCount: countOf(post.likes),
    isLikedByMe: likedPosts.has(post.id),
    replies,
  };
}
