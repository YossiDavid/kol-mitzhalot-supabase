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

  return { supabase, user };
}

export async function createPost(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();

  if (!title || !content) throw new Error("כותרת ותוכן הם שדות חובה");

  const { supabase, user } = await getAuthorizedUser();

  const { data, error } = await supabase
    .from("forum_posts")
    .insert({ title, content, author_id: user.id })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  redirect(`/app/forums/${data.id}`);
}

export async function createReply(postId: string, formData: FormData) {
  const content = (formData.get("content") as string)?.trim();
  if (!content) throw new Error("תוכן התגובה לא יכול להיות ריק");

  const { supabase, user } = await getAuthorizedUser();

  const { error } = await supabase
    .from("forum_replies")
    .insert({ post_id: postId, content, author_id: user.id });

  if (error) throw new Error(error.message);

  revalidatePath(`/app/forums/${postId}`);
}

export async function deletePost(postId: string) {
  const { supabase } = await getAuthorizedUser();

  const { error } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", postId);

  if (error) throw new Error(error.message);

  revalidatePath("/app/forums");
  redirect("/app/forums");
}

export async function deleteReply(replyId: string, postId: string) {
  const { supabase } = await getAuthorizedUser();

  const { error } = await supabase
    .from("forum_replies")
    .delete()
    .eq("id", replyId);

  if (error) throw new Error(error.message);

  revalidatePath(`/app/forums/${postId}`);
}
