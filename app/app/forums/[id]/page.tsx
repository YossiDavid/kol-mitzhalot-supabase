import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { ArrowRight, MessageSquare, Pin, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ReplyForm } from "./reply-form";
import { deletePost, deleteReply } from "../actions";

type Params = { id: string };

async function getAuthorName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  uid: string,
): Promise<string> {
  const { data } = await supabase.rpc("get_user_metadata", {
    target_user_id: uid,
  });
  if (data?.firstName || data?.lastName) {
    return `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
  }
  if (data?.email) return data.email.split("@")[0];
  return "משתמש";
}

export default async function ForumPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  noStore();
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.user_metadata?.role;
  const isAdmin = role === "admin";
  const canWrite = isAdmin || role === "shadchan";

  const { data: post } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (!post) notFound();

  const { data: replies } = await supabase
    .from("forum_replies")
    .select("*")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

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
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/app/forums">
            <ArrowRight />
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          {post.is_pinned && <Pin className="text-primary h-5 w-5" />}
          {post.title}
        </h1>
      </div>

      {/* תוכן הפוסט */}
      <div className="mt-6 rounded-lg border p-6">
        <div className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">
            {authorNames[post.author_id]}
          </span>
          <span>·</span>
          <span>{new Date(post.created_at).toLocaleDateString("he-IL")}</span>
        </div>
        <p className="whitespace-pre-wrap leading-relaxed">{post.content}</p>
        {(isPostAuthor || isAdmin) && (
          <form
            action={deletePost.bind(null, post.id)}
            className="mt-4 flex justify-end"
          >
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="me-1 h-4 w-4" />
              מחק נושא
            </Button>
          </form>
        )}
      </div>

      {/* תגובות */}
      <div className="mt-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5" />
          תגובות ({replies?.length ?? 0})
        </h2>

        {replies && replies.length > 0 ? (
          <div className="space-y-4">
            {replies.map((reply) => {
              const isReplyAuthor = user?.id === reply.author_id;
              return (
                <div key={reply.id} className="rounded-lg border p-4">
                  <div className="text-muted-foreground mb-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {authorNames[reply.author_id]}
                      </span>
                      <span>·</span>
                      <span>
                        {new Date(reply.created_at).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    {(isReplyAuthor || isAdmin) && (
                      <form action={deleteReply.bind(null, reply.id, id)}>
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
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {reply.content}
                  </p>
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
            <ReplyForm postId={id} />
          </div>
        </>
      )}
    </Section>
  );
}
