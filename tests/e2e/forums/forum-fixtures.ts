import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";

import { createServiceClient } from "../shidduchim/fixtures";

/** שדכן מאושר נוסף (שאינו משתמש הבדיקה), לתוכן "של מישהו אחר" */
export interface OtherMatchmaker {
  id: string;
  email: string;
}

export async function setShadchanApproval(
  service: SupabaseClient,
  userId: string,
  status: "approved" | "pending",
) {
  const { error } = await service
    .from("shadchanim_info")
    .upsert(
      { user_id: userId, application_status: status },
      { onConflict: "user_id" },
    );
  expect(error).toBeNull();
}

export async function createApprovedMatchmaker(
  service: SupabaseClient,
  runId: number,
): Promise<OtherMatchmaker> {
  const email = `forum-delete-${runId}@kol-mitzhalot.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    phone: `+9725${String(runId).slice(-8)}`,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { roles: ["shadchan"] },
    user_metadata: { firstName: "כותב", lastName: `פורום${runId}` },
  });
  expect(error).toBeNull();
  const id = data.user!.id;
  await service
    .from("user_profiles")
    .upsert({ id, first_name: "כותב", last_name: `פורום${runId}` });
  await setShadchanApproval(service, id, "approved");
  return { id, email };
}

/** פוסט עם תגובות ולייקים, נוצר דרך ה-service client. מחזיר את המזהים. */
export async function seedPost(
  service: SupabaseClient,
  params: {
    authorId: string;
    title: string;
    replies: { authorId: string; content: string }[];
    likerIds: string[];
  },
) {
  const { data: post, error } = await service
    .from("forum_posts")
    .insert({
      author_id: params.authorId,
      title: params.title,
      content: "תוכן לבדיקת מחיקה",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const postId = post!.id as string;

  const { data: replies, error: replyError } = await service
    .from("forum_replies")
    .insert(
      params.replies.map((reply) => ({
        post_id: postId,
        author_id: reply.authorId,
        content: reply.content,
      })),
    )
    .select("id, content");
  expect(replyError).toBeNull();

  const likes = [
    ...params.likerIds.map((id) => ({ user_id: id, post_id: postId })),
    ...(replies ?? []).map((reply, index) => ({
      user_id: params.likerIds[index % params.likerIds.length],
      reply_id: reply.id as string,
    })),
  ];
  const { error: likeError } = await service.from("forum_likes").insert(likes);
  expect(likeError).toBeNull();

  return {
    postId,
    replyIds: (replies ?? []).map((reply) => reply.id as string),
  };
}

/** כמה שורות נשארו לפוסט: הוא עצמו, התגובות והלייקים (לפוסט ולתגובותיו) */
export async function countForumRows(
  service: SupabaseClient,
  postId: string,
  replyIds: string[],
) {
  const count = async (query: PromiseLike<{ count: number | null }>) =>
    (await query).count ?? 0;

  const [posts, replies, postLikes, replyLikes] = await Promise.all([
    count(
      service
        .from("forum_posts")
        .select("id", { count: "exact", head: true })
        .eq("id", postId),
    ),
    count(
      service
        .from("forum_replies")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId),
    ),
    count(
      service
        .from("forum_likes")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId),
    ),
    count(
      service
        .from("forum_likes")
        .select("id", { count: "exact", head: true })
        .in("reply_id", replyIds),
    ),
  ]);
  return { posts, replies, likes: postLikes + replyLikes };
}

/**
 * לקוח Supabase בסשן אמיתי של משתמש (anon key + JWT שלו), כך שה-RLS חל עליו
 * בדיוק כמו על הדפדפן. משמש להוכחה שהחסימה היא במסד ולא רק בכפתור או בנתיב.
 */
export async function createUserSessionClient(
  service: SupabaseClient,
  email: string,
): Promise<SupabaseClient> {
  const { data: link, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  expect(error).toBeNull();

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyError } = await client.auth.verifyOtp({
    token_hash: link?.properties?.hashed_token ?? "",
    type: "magiclink",
  });
  expect(verifyError).toBeNull();
  return client;
}

export { createServiceClient };
