import { MessageCircle, Pin } from "lucide-react";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { Page, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/ui/card-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import ForumAccessNotice from "@/features/forums/components/access-notice";
import ForumDeleteButton from "@/features/forums/components/forum-delete-button";
import ForumLikeButton from "@/features/forums/components/like-button";
import { getForumAccess } from "@/features/forums/lib/access";
import { formatForumDate, postPreview } from "@/features/forums/lib/format";
import {
  listForumCategories,
  listForumPosts,
} from "@/features/forums/lib/queries";
import type { ForumPostSummary } from "@/features/forums/lib/types";
import CreatePostDialog from "./create-post-dialog";

/** כמה שלדי פוסטים להציג בזמן הטעינה. */
const SKELETON_POST_COUNT = 3;

type ForumSearchParams = Promise<{ cat?: string }>;

/** כפתור הפרסום מופיע רק למי שמורשה לכתוב בפורום */
async function ForumActions() {
  noStore();
  const access = await getForumAccess();
  if (access.status !== "allowed") return null;

  const categories = await listForumCategories();
  return <CreatePostDialog categories={categories} />;
}

async function CategoryFilters({
  searchParams,
}: {
  searchParams: ForumSearchParams;
}) {
  noStore();
  const access = await getForumAccess();
  if (access.status !== "allowed") return null;

  const [{ cat: currentCat = "" }, categories] = await Promise.all([
    searchParams,
    listForumCategories(),
  ]);
  if (categories.length === 0) return null;

  const filters = [{ id: "all", name: "הכל", slug: "" }, ...categories];

  return (
    <nav aria-label="סינון לפי נושא" className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.id}
          asChild
          size="sm"
          variant={currentCat === filter.slug ? "default" : "outline"}
        >
          <Link
            href={
              (filter.slug
                ? `/app/forums?cat=${filter.slug}`
                : "/app/forums") as never
            }
            aria-current={currentCat === filter.slug ? "page" : undefined}
          >
            {filter.name}
          </Link>
        </Button>
      ))}
    </nav>
  );
}

function PostCard({
  post,
  canDelete,
}: {
  post: ForumPostSummary;
  canDelete: boolean;
}) {
  return (
    <Card asChild>
      <article data-testid="forum-post">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            {post.isPinned && (
              <Badge variant="info">
                <Pin aria-hidden /> מוצמד
              </Badge>
            )}
            {post.category && (
              <Badge variant="neutral">{post.category.name}</Badge>
            )}
          </div>
          <CardTitle asChild>
            <h2>
              <Link
                href={`/app/forums/${post.id}` as never}
                className="hover:underline"
              >
                {post.title}
              </Link>
            </h2>
          </CardTitle>
          <CardDescription className="text-caption">
            {post.authorName} · {formatForumDate(post.createdAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
            {postPreview(post.content)}
          </p>
          <div className="flex items-center gap-1">
            <ForumLikeButton
              target={{ postId: post.id }}
              initialCount={post.likeCount}
              initialLiked={post.isLikedByMe}
            />
            <Button asChild variant="ghost" size="sm">
              <Link href={`/app/forums/${post.id}` as never}>
                <MessageCircle className="size-4" aria-hidden />
                {post.replyCount} תגובות
              </Link>
            </Button>
            {canDelete && (
              <ForumDeleteButton
                target={{
                  kind: "post",
                  id: post.id,
                  replyCount: post.replyCount,
                }}
              />
            )}
          </div>
        </CardContent>
      </article>
    </Card>
  );
}

async function ForumPosts({
  searchParams,
}: {
  searchParams: ForumSearchParams;
}) {
  noStore();
  const access = await getForumAccess();
  if (access.status !== "allowed") {
    return <ForumAccessNotice status={access.status} />;
  }

  const { cat: currentCat = "" } = await searchParams;
  const posts = await listForumPosts(access.userId, currentCat);

  if (posts === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>לא הצלחנו לטעון את הפורום</EmptyTitle>
          <EmptyDescription>
            אנא רעננו את הדף או נסו שוב בעוד מספר דקות.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (posts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {currentCat ? "אין פוסטים בנושא זה" : "אין פוסטים עדיין"}
          </EmptyTitle>
          <EmptyDescription>היו הראשונים לפרסם!</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          canDelete={access.isAdmin || post.authorId === access.userId}
        />
      ))}
    </>
  );
}

/** שלד רשימת הפוסטים, במבנה של כרטיס פוסט אמיתי. */
function ForumPostsSkeleton() {
  return <CardGridSkeleton count={SKELETON_POST_COUNT} lines={2} />;
}

export default function ForumsPage({
  searchParams,
}: {
  searchParams: ForumSearchParams;
}) {
  return (
    <Page>
      <PageHeader
        title="פורום שדכנים"
        description="מקום לשאלות, עצות, ושיתוף ידע בין שדכנים"
        actions={
          <Suspense
            fallback={
              <Skeleton
                role="status"
                aria-label="טוען"
                className="h-11 w-28 md:h-10"
              />
            }
          >
            <ForumActions />
          </Suspense>
        }
      />

      <Suspense fallback={null}>
        <CategoryFilters searchParams={searchParams} />
      </Suspense>

      <div className="space-y-4">
        <Suspense fallback={<ForumPostsSkeleton />}>
          <ForumPosts searchParams={searchParams} />
        </Suspense>
      </div>
    </Page>
  );
}
