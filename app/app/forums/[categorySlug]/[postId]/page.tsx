import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ArrowRight, MessageSquare, Trash2, Pin } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LikeButton } from "./like-button";
import { ReplyForm } from "./reply-form";
import { EditPostForm } from "./edit-post-form";
import { EditReplyForm } from "./edit-reply-form";
import { deletePost, deleteReply } from "../../actions";

type Params = { categorySlug: string; postId: string };

async function getAuthorName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uid: string,
): Promise<string> {
  const { data } = await supabase.rpc("get_user_metadata", {
    target_user_id: uid,
  });
  if (data?.firstName || data?.lastName)
    return `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
  if (data?.email) return data.email.split("@")[0];
  return "משתמש";
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  noStore();
  const { categorySlug, postId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.user_metadata?.role;
  const isAdmin = role === "admin";
  const canWrite = isAdmin || role === "shadchan";

  // שאילתות בסיסיות
  const [{ data: category }, { data: post }] = await Promise.all([
    supabase
      .from("forum_categories")
      .select("id, name, slug")
      .eq("slug", categorySlug)
      .single(),
    supabase.from("forum_posts").select("*").eq("id", postId).single(),
  ]);

  if (!category || !post) notFound();

  const { data: replies } = await supabase
    .from("forum_replies")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  // likes בשאילתא נפרדת
  const replyIds = (replies ?? []).map((r: { id: string }) => r.id);
  const [{ data: postLikes }, { data: replyLikes }] = await Promise.all([
    supabase.from("forum_likes").select("user_id").eq("post_id", postId),
    replyIds.length > 0
      ? supabase
          .from("forum_likes")
          .select("user_id, reply_id")
          .in("reply_id", replyIds)
      : Promise.resolve({ data: [] as { user_id: string; reply_id: string }[] }),
  ]);

  const postLikesCount = postLikes?.length ?? 0;
  const postLiked = (postLikes ?? []).some((l) => l.user_id === user?.id);

  // author names
  const allAuthorIds = [
    post.author_id,
    ...((replies ?? []).map((r: { author_id: string }) => r.author_id)),
  ];
  const uniqueIds = [...new Set(allAuthorIds)];
  const authorNames: Record<string, string> = {};
  await Promise.all(
    uniqueIds.map(async (uid) => {
      authorNames[uid] = await getAuthorName(supabase, uid);
    }),
  );

  const isPostAuthor = user?.id === post.author_id;

  return (
    <Section containerClassName="py-10">
      {/* breadcrumb */}
      <div className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
        <Link href="/app/forums" className="hover:underline">
          פורום
        </Link>
        <span>/</span>
        <Link href={`/app/forums/${categorySlug}`} className="hover:underline">
          {category.name}
        </Link>
      </div>

      {/* כותרת */}
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="mt-0.5 shrink-0">
          <Link href={`/app/forums/${categorySlug}` as any}>
            <ArrowRight />
          </Link>
        </Button>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          {post.is_pinned && <Pin className="text-primary h-5 w-5 shrink-0" />}
          {post.title}
        </h1>
      </div>

      {/* תגיות */}
      {(post.tags as string[])?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(post.tags as string[]).map((t) => (
            <Link
              key={t}
              href={`/app/forums/${categorySlug}?tag=${encodeURIComponent(t)}` as any}
            >
              <Badge variant="secondary">{t}</Badge>
            </Link>
          ))}
        </div>
      )}

      {/* תוכן הפוסט */}
      <div className="mt-6 rounded-xl border p-6">
        <div className="text-muted-foreground mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              {authorNames[post.author_id]}
            </span>
            <span>·</span>
            <span>{new Date(post.created_at).toLocaleDateString("he-IL")}</span>
            {post.updated_at !== post.created_at && (
              <>
                <span>·</span>
                <span className="italic">נערך</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(isPostAuthor || isAdmin) && (
              <EditPostForm
                postId={post.id}
                defaultTitle={post.title}
                defaultContent={post.content}
                defaultTags={(post.tags as string[]) ?? []}
              />
            )}
            {(isPostAuthor || isAdmin) && (
              <form action={deletePost.bind(null, post.id, categorySlug)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="me-1 h-4 w-4" />
                  מחק
                </Button>
              </form>
            )}
          </div>
        </div>
        <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>
        <div className="mt-4">
          <LikeButton postId={post.id} count={postLikesCount} liked={postLiked} />
        </div>
      </div>

      {/* תגובות */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5" />
          תגובות ({replies?.length ?? 0})
        </h2>

        {replies && replies.length > 0 ? (
          <div className="space-y-4">
            {(replies as {
              id: string;
              author_id: string;
              content: string;
              created_at: string;
              updated_at: string | null;
            }[]).map((reply) => {
              const rLikes = (replyLikes ?? []).filter(
                (l) => l.reply_id === reply.id,
              );
              const replyLikesCount = rLikes.length;
              const replyLiked = rLikes.some((l) => l.user_id === user?.id);
              const isReplyAuthor = user?.id === reply.author_id;

              return (
                <div key={reply.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {authorNames[reply.author_id]}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(reply.created_at).toLocaleDateString("he-IL")}
                      </span>
                      {reply.updated_at && reply.updated_at !== reply.created_at && (
                        <>
                          <span>·</span>
                          <span className="text-xs italic">נערך</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {(isReplyAuthor || isAdmin) && (
                        <EditReplyForm
                          replyId={reply.id}
                          postId={postId}
                          categorySlug={categorySlug}
                          defaultContent={reply.content}
                        />
                      )}
                      {(isReplyAuthor || isAdmin) && (
                        <form
                          action={deleteReply.bind(
                            null,
                            reply.id,
                            postId,
                            categorySlug,
                          )}
                        >
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-7 w-7"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {reply.content}
                  </p>
                  <div className="mt-2">
                    <LikeButton
                      replyId={reply.id}
                      count={replyLikesCount}
                      liked={replyLiked}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            עדיין אין תגובות. היה הראשון להגיב!
          </p>
        )}
      </div>

      {/* טופס תגובה */}
      {canWrite && (
        <>
          <Separator className="my-8" />
          <div>
            <h3 className="mb-4 text-base font-semibold">הוסף תגובה</h3>
            <ReplyForm postId={postId} categorySlug={categorySlug} />
          </div>
        </>
      )}
    </Section>
  );
}
