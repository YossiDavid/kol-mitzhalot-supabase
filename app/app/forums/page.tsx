import { Page, PageHeader } from "@/components/layout";
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
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";
import CreatePostDialog from "./create-post-dialog";

/** כמה שלדי פוסטים להציג בזמן הטעינה. */
const SKELETON_POST_COUNT = 3;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ForumPost = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  author_id: string | null;
};

/** כפתור הפרסום תלוי בתפקיד המשתמש, ולכן נקרא מאחורי גבול נפרד. */
async function ForumActions() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const canPost = hasRole(user, "shadchan") || hasRole(user, "admin");

  return canPost ? <CreatePostDialog /> : null;
}

async function ForumPosts() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const canPost = hasRole(user, "shadchan") || hasRole(user, "admin");

  const { data: posts } = await supabase
    .from("forum_posts")
    .select("id, title, body, created_at, author_id")
    .order("created_at", { ascending: false })
    .limit(50);

  const postList: ForumPost[] = posts ?? [];

  if (postList.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>אין פוסטים עדיין</EmptyTitle>
          <EmptyDescription>
            {canPost
              ? "היה הראשון לפרסם!"
              : "הפורום יתמלא בקרוב בתוכן מהשדכנים."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {postList.map((post) => (
        <Card key={post.id} asChild>
          <article>
            <CardHeader>
              <CardTitle asChild>
                <h2>{post.title}</h2>
              </CardTitle>
              <CardDescription className="text-caption">
                {formatDate(post.created_at)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-body-sm leading-relaxed whitespace-pre-wrap">
                {post.body}
              </p>
            </CardContent>
          </article>
        </Card>
      ))}
    </>
  );
}

/** שלד רשימת הפוסטים, במבנה של כרטיס פוסט אמיתי. */
function ForumPostsSkeleton() {
  return <CardGridSkeleton count={SKELETON_POST_COUNT} lines={2} />;
}

export default function ForumsPage() {
  return (
    <Page>
      <PageHeader
        title="פורום שדכנים"
        description="מקום לשאלות, עצות, ושיתוף ידע בין שדכנים"
        actions={
          <Suspense
            fallback={
              <Skeleton role="status" aria-label="טוען" className="h-11 w-28 md:h-10" />
            }
          >
            <ForumActions />
          </Suspense>
        }
      />

      <div className="space-y-4">
        <Suspense fallback={<ForumPostsSkeleton />}>
          <ForumPosts />
        </Suspense>
      </div>
    </Page>
  );
}
