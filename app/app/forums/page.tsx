import { Section } from "@/components/layout";
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
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        <p className="text-subtitle font-medium">אין פוסטים עדיין</p>
        <p className="mt-1 text-body-sm">
          {canPost
            ? "היה הראשון לפרסם!"
            : "הפורום יתמלא בקרוב בתוכן מהשדכנים."}
        </p>
      </div>
    );
  }

  return (
    <>
      {postList.map((post) => (
        <article
          key={post.id}
          className="rounded-xl border bg-card p-5 text-right shadow-sm transition-shadow hover:shadow-md"
          dir="rtl"
        >
          <h2 className="text-subtitle leading-snug font-semibold">
            {post.title}
          </h2>
          <p className="mt-0.5 text-caption text-muted-foreground">
            {formatDate(post.created_at)}
          </p>
          <p className="mt-3 text-body-sm leading-relaxed whitespace-pre-wrap">
            {post.body}
          </p>
        </article>
      ))}
    </>
  );
}

/** שלד רשימת הפוסטים, במבנה של כרטיס פוסט אמיתי. */
function ForumPostsSkeleton() {
  return (
    <div role="status" aria-label="טוען" className="space-y-4">
      {Array.from({ length: SKELETON_POST_COUNT }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 shadow-sm">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-2 h-3 w-40" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export default function ForumsPage() {
  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading font-bold">פורום שדכנים</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            מקום לשאלות, עצות, ושיתוף ידע בין שדכנים
          </p>
        </div>
        <Suspense
          fallback={
            <Skeleton role="status" aria-label="טוען" className="h-9 w-28" />
          }
        >
          <ForumActions />
        </Suspense>
      </div>

      <div className="mt-8 space-y-4">
        <Suspense fallback={<ForumPostsSkeleton />}>
          <ForumPosts />
        </Suspense>
      </div>
    </Section>
  );
}
