/** Server-side reads for the shadchanim forum. RLS limits them to approved shadchanim and admins. */

import { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import type {
  ForumCategory,
  ForumPostDetail,
  ForumPostSummary,
  ForumReply,
} from "./types";

/** כמה פוסטים נטענים לרשימה */
const FORUM_POSTS_LIMIT = 50;

const FALLBACK_AUTHOR_NAME = "שדכן";

type CountRow = { count: number }[] | null;

type PostRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_id: string;
  is_pinned: boolean | null;
  category: ForumCategory | null;
  replies: CountRow;
  likes: CountRow;
};

type ReplyRow = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  likes: CountRow;
};

const POST_COLUMNS = `id, title, content, created_at, author_id, is_pinned,
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
  for (const row of (data ?? []) as {
    user_id: string;
    display_name: string | null;
  }[]) {
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
  const rows = (data ?? []) as unknown as Record<string, string | null>[];
  return new Set(
    rows.map((row) => row[column]).filter((id): id is string => !!id),
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

/** פוסטים מוצמדים קודם, אחריהם החדשים ביותר. null בכשל, כדי להבדיל משגיאה ל"אין פוסטים" */
export async function listForumPosts(
  userId: string,
  categorySlug: string,
): Promise<ForumPostSummary[] | null> {
  const supabase = await createClient();

  let categoryId: string | null = null;
  if (categorySlug) {
    const categories = await listForumCategories();
    categoryId = categories.find((c) => c.slug === categorySlug)?.id ?? null;
    if (!categoryId) return [];
  }

  let query = supabase
    .from("forum_posts")
    .select(POST_COLUMNS)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(FORUM_POSTS_LIMIT);
  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query;
  if (error) {
    console.error("[forums/posts]", describeSupabaseError(error));
    return null;
  }

  const rows = (data ?? []) as unknown as PostRow[];
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

  return rows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    isPinned: row.is_pinned === true,
    authorName: names.get(row.author_id) ?? FALLBACK_AUTHOR_NAME,
    category: row.category,
    replyCount: countOf(row.replies),
    likeCount: countOf(row.likes),
    isLikedByMe: likedIds.has(row.id),
  }));
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
  const post = data as unknown as PostRow;

  const { data: replyData, error: replyError } = await supabase
    .from("forum_replies")
    .select("id, content, created_at, author_id, likes:forum_likes(count)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (replyError) {
    console.error("[forums/replies]", describeSupabaseError(replyError));
  }
  const replyRows = (replyData ?? []) as unknown as ReplyRow[];

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
    isPinned: post.is_pinned === true,
    authorName: names.get(post.author_id) ?? FALLBACK_AUTHOR_NAME,
    category: post.category,
    likeCount: countOf(post.likes),
    isLikedByMe: likedPosts.has(post.id),
    replies,
  };
}
