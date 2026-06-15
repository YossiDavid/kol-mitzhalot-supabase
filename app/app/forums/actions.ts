"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getAuthorizedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("לא מחובר");

  const role = user.user_metadata?.role;
  const isAdmin = role === "admin";
  const isShadchan = role === "shadchan";

  if (!isAdmin && !isShadchan) {
    throw new Error("אין הרשאה לכתוב בפורום");
  }

  return { supabase, user, isAdmin };
}

export async function createPost(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const category_id = (formData.get("category_id") as string) || null;
  const tagsRaw = (formData.get("tags") as string) || "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!title || !content) throw new Error("כותרת ותוכן הם שדות חובה");

  const { supabase, user } = await getAuthorizedUser();

  const { data, error } = await supabase
    .from("forum_posts")
    .insert({ title, content, author_id: user.id, category_id, tags })
    .select("id, forum_categories(slug)")
    .single();

  if (error) throw new Error(error.message);

  const slug = (data.forum_categories as { slug: string }[] | null)?.[0]?.slug ?? "general";
  redirect(`/app/forums/${slug}/${data.id}`);
}

export async function updatePost(postId: string, formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();
  const tagsRaw = (formData.get("tags") as string) || "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!title || !content) throw new Error("כותרת ותוכן הם שדות חובה");

  const { supabase, user, isAdmin } = await getAuthorizedUser();

  const { data: post } = await supabase
    .from("forum_posts")
    .select("author_id, forum_categories(slug)")
    .eq("id", postId)
    .single();

  if (!post) throw new Error("פוסט לא נמצא");
  if (!isAdmin && post.author_id !== user.id) throw new Error("אין הרשאה לעריכה");

  const { error } = await supabase
    .from("forum_posts")
    .update({ title, content, tags, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) throw new Error(error.message);

  const slug = (post.forum_categories as { slug: string }[] | null)?.[0]?.slug ?? "general";
  revalidatePath(`/app/forums/${slug}/${postId}`);
}

export async function createReply(postId: string, categorySlug: string, formData: FormData) {
  const content = (formData.get("content") as string)?.trim();
  if (!content) throw new Error("תוכן התגובה לא יכול להיות ריק");

  const { supabase, user } = await getAuthorizedUser();

  const { error } = await supabase
    .from("forum_replies")
    .insert({ post_id: postId, content, author_id: user.id });

  if (error) throw new Error(error.message);

  revalidatePath(`/app/forums/${categorySlug}/${postId}`);
}

export async function updateReply(replyId: string, postId: string, categorySlug: string, formData: FormData) {
  const content = (formData.get("content") as string)?.trim();
  if (!content) throw new Error("תוכן התגובה לא יכול להיות ריק");

  const { supabase, user, isAdmin } = await getAuthorizedUser();

  const { data: reply } = await supabase
    .from("forum_replies")
    .select("author_id")
    .eq("id", replyId)
    .single();

  if (!reply) throw new Error("תגובה לא נמצאה");
  if (!isAdmin && reply.author_id !== user.id) throw new Error("אין הרשאה לעריכה");

  const { error } = await supabase
    .from("forum_replies")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", replyId);

  if (error) throw new Error(error.message);

  revalidatePath(`/app/forums/${categorySlug}/${postId}`);
}

export async function deletePost(postId: string, categorySlug: string) {
  const { supabase, user, isAdmin } = await getAuthorizedUser();

  const { data: post } = await supabase
    .from("forum_posts")
    .select("author_id")
    .eq("id", postId)
    .single();

  if (!post) throw new Error("פוסט לא נמצא");
  if (!isAdmin && post.author_id !== user.id) throw new Error("אין הרשאה למחיקה");

  const { error } = await supabase.from("forum_posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);

  revalidatePath(`/app/forums/${categorySlug}`);
  redirect(`/app/forums/${categorySlug}`);
}

export async function deleteReply(replyId: string, postId: string, categorySlug: string) {
  const { supabase, user, isAdmin } = await getAuthorizedUser();

  const { data: reply } = await supabase
    .from("forum_replies")
    .select("author_id")
    .eq("id", replyId)
    .single();

  if (!reply) throw new Error("תגובה לא נמצאה");
  if (!isAdmin && reply.author_id !== user.id) throw new Error("אין הרשאה למחיקה");

  const { error } = await supabase.from("forum_replies").delete().eq("id", replyId);
  if (error) throw new Error(error.message);

  revalidatePath(`/app/forums/${categorySlug}/${postId}`);
}

export async function toggleLike(postId?: string, replyId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("לא מחובר");

  const field = postId ? "post_id" : "reply_id";
  const value = postId ?? replyId;

  const { data: existing } = await supabase
    .from("forum_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq(field, value!)
    .maybeSingle();

  if (existing) {
    await supabase.from("forum_likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("forum_likes").insert({
      user_id: user.id,
      post_id: postId ?? null,
      reply_id: replyId ?? null,
    });
  }

  if (postId) {
    const { data: post } = await supabase
      .from("forum_posts")
      .select("forum_categories(slug)")
      .eq("id", postId)
      .single();
    const slug = (post?.forum_categories as { slug: string }[] | null)?.[0]?.slug ?? "general";
    revalidatePath(`/app/forums/${slug}/${postId}`);
  }
}
