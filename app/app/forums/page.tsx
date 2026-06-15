import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { MessageSquare, PlusCircle, BookOpen } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/layout";
import { Button } from "@/components/ui/button";

export default async function ForumsPage() {
  noStore();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.user_metadata?.role;
  const canWrite = role === "admin" || role === "shadchan";

  const { data: categories } = await supabase
    .from("forum_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  // לכל קטגוריה — ספירת נושאים, ספירת תגובות, ותאריך עדכון אחרון
  const categoryStats = await Promise.all(
    (categories ?? []).map(async (cat) => {
      const [{ count: postsCount }, { data: lastPost }] = await Promise.all([
        supabase
          .from("forum_posts")
          .select("*", { count: "exact", head: true })
          .eq("category_id", cat.id)
          .then((r) => ({ count: r.count ?? 0 })),
        supabase
          .from("forum_posts")
          .select("id, title, created_at")
          .eq("category_id", cat.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .then((r) => ({ data: r.data?.[0] ?? null })),
      ]);

      return { ...cat, postsCount, lastPost };
    }),
  );

  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">פורום השדכנים</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            דיונים מקצועיים, שאלות וטיפים לקהילת השדכנים
          </p>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href="/app/forums/create">
              <PlusCircle />
              נושא חדש
            </Link>
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {categoryStats.map((cat) => (
          <Link
            key={cat.id}
            href={`/app/forums/${cat.slug}`}
            className="hover:bg-muted group rounded-xl border p-5 transition"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold group-hover:underline">{cat.name}</p>
                <p className="text-muted-foreground text-sm">{cat.description}</p>
              </div>
            </div>
            <div className="text-muted-foreground flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {cat.postsCount} נושאים
              </span>
              {cat.lastPost && (
                <>
                  <span>·</span>
                  <span className="truncate">
                    עדכון אחרון:{" "}
                    {new Date(cat.lastPost.created_at).toLocaleDateString("he-IL")}
                  </span>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
