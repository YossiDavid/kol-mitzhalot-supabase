import { Section } from "@/components/layout";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";
import CreatePostDialog from "./create-post-dialog";

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

export default async function ForumsPage() {
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

  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading font-bold">פורום שדכנים</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            מקום לשאלות, עצות, ושיתוף ידע בין שדכנים
          </p>
        </div>
        {canPost && <CreatePostDialog />}
      </div>

      <div className="mt-8 space-y-4">
        {postList.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <p className="text-subtitle font-medium">אין פוסטים עדיין</p>
            <p className="mt-1 text-body-sm">
              {canPost
                ? "היה הראשון לפרסם!"
                : "הפורום יתמלא בקרוב בתוכן מהשדכנים."}
            </p>
          </div>
        ) : (
          postList.map((post) => (
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
          ))
        )}
      </div>
    </Section>
  );
}
