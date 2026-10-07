import { ArrowRight } from "lucide-react";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Page, PageTitle } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/ui/card-skeleton";
import ForumAccessNotice from "@/features/forums/components/access-notice";
import ForumLikeButton from "@/features/forums/components/like-button";
import ReplyForm from "@/features/forums/components/reply-form";
import { getForumAccess } from "@/features/forums/lib/access";
import { formatForumDate } from "@/features/forums/lib/format";
import { getForumPost } from "@/features/forums/lib/queries";
import type { ForumReply } from "@/features/forums/lib/types";
import { z } from "zod";

function ReplyItem({ reply }: { reply: ForumReply }) {
  return (
    <Card size="sm" asChild>
      <article data-testid="forum-reply">
        <p className="text-caption text-muted-foreground">
          {reply.authorName} · {formatForumDate(reply.createdAt)}
        </p>
        <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
          {reply.content}
        </p>
        <div>
          <ForumLikeButton
            target={{ replyId: reply.id }}
            initialCount={reply.likeCount}
            initialLiked={reply.isLikedByMe}
          />
        </div>
      </article>
    </Card>
  );
}

async function ForumPostContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const access = await getForumAccess();
  if (access.status !== "allowed") {
    return <ForumAccessNotice status={access.status} />;
  }

  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();

  const post = await getForumPost(access.userId, id);
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <Card asChild>
        <article>
          <div className="flex flex-wrap items-center gap-2">
            {post.category && (
              <Badge variant="neutral">{post.category.name}</Badge>
            )}
          </div>
          <PageTitle>{post.title}</PageTitle>
          <p className="text-caption text-muted-foreground">
            {post.authorName} · {formatForumDate(post.createdAt)}
          </p>
          <p className="text-body leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>
          <div>
            <ForumLikeButton
              target={{ postId: post.id }}
              initialCount={post.likeCount}
              initialLiked={post.isLikedByMe}
            />
          </div>
        </article>
      </Card>

      <section aria-labelledby="forum-replies-title" className="space-y-4">
        <h2 id="forum-replies-title" className="text-subtitle font-bold">
          תגובות ({post.replies.length})
        </h2>
        {post.replies.map((reply) => (
          <ReplyItem key={reply.id} reply={reply} />
        ))}
        <Card size="sm">
          <ReplyForm postId={post.id} />
        </Card>
      </section>
    </div>
  );
}

export default function ForumPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Page width="content">
      <Link
        href={"/app/forums" as never}
        className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4" aria-hidden />
        חזרה לפורום
      </Link>

      <Suspense fallback={<CardGridSkeleton count={2} lines={3} />}>
        <ForumPostContent params={params} />
      </Suspense>
    </Page>
  );
}
