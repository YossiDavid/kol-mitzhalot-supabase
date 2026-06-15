import { notFound } from "next/navigation";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { MessageSquare, Heart, PlusCircle, ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SearchBar } from "./search-bar";

type Params = { categorySlug: string };
type SearchParams = { search?: string; tag?: string };

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  noStore();
  const { categorySlug } = await params;
  const { search, tag } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.user_metadata?.role;
  const canWrite = role === "admin" || role === "shadchan";

  const { data: category } = await supabase
    .from("forum_categories")
    .select("*")
    .eq("slug", categorySlug)
    .single();

  if (!category) notFound();

  let query = supabase
    .from("forum_posts")
    .select(
      `id, title, content, tags, is_pinned, created_at, author_id,
       forum_replies(count),
       forum_likes(count)`,
    )
    .eq("category_id", category.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data: posts } = await query;

  const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))];
  const authorNames: Record<string, string> = {};
  await Promise.all(
    authorIds.map(async (uid) => {
      const { data } = await supabase.rpc("get_user_metadata", {
        target_user_id: uid,
      });
      if (data?.firstName || data?.lastName) {
        authorNames[uid] = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
      } else if (data?.email) {
        authorNames[uid] = data.email.split("@")[0];
      } else {
        authorNames[uid] = "משתמש";
      }
    }),
  );

  // אסוף את כל התגיות הייחודיות בקטגוריה
  const allTags = [
    ...new Set((posts ?? []).flatMap((p) => (p.tags as string[]) ?? [])),
  ].filter(Boolean);

  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/app/forums">
              <ArrowRight />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{category.name}</h1>
            <p className="text-muted-foreground text-sm">{category.description}</p>
          </div>
        </div>
        {canWrite && (
          <Button asChild>
            <Link href={`/app/forums/create`}>
              <PlusCircle />
              נושא חדש
            </Link>
          </Button>
        )}
      </div>

      {/* חיפוש + תגיות */}
      <div className="mt-6 space-y-3">
        <SearchBar defaultValue={search} />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tag && (
              <Link href={`/app/forums/${categorySlug}` as any}>
                <Badge variant="secondary" className="cursor-pointer">
                  × הסר פילטר
                </Badge>
              </Link>
            )}
            {allTags.map((t) => (
              <Link
                key={t}
                href={`/app/forums/${categorySlug}?tag=${encodeURIComponent(t)}` as any}
              >
                <Badge
                  variant={tag === t ? "default" : "outline"}
                  className="cursor-pointer"
                >
                  {t}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* רשימת נושאים */}
      {posts && posts.length > 0 ? (
        <div className="mt-6 space-y-3">
          {posts.map((post) => {
            const repliesCount =
              (post.forum_replies as unknown as { count: number }[])?.[0]
                ?.count ?? 0;
            const likesCount =
              (post.forum_likes as unknown as { count: number }[])?.[0]
                ?.count ?? 0;

            return (
              <Link
                key={post.id}
                href={`/app/forums/${categorySlug}/${post.id}` as any}
                className="hover:bg-muted block rounded-lg border p-4 transition"
              >
                <div className="mb-2 flex items-start gap-2">
                  <p className="flex-1 font-semibold">{post.title}</p>
                </div>
                <p className="text-muted-foreground mb-3 line-clamp-1 text-sm">
                  {post.content}
                </p>
                {(post.tags as string[])?.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {(post.tags as string[]).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span>{authorNames[post.author_id]}</span>
                  <span>·</span>
                  <span>
                    {new Date(post.created_at).toLocaleDateString("he-IL")}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {repliesCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {likesCount}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyTitle>
              {search || tag ? "לא נמצאו נושאים" : "עדיין אין נושאים בקטגוריה זו"}
            </EmptyTitle>
            <EmptyDescription>
              {search || tag
                ? "נסה לשנות את החיפוש או הפילטר"
                : canWrite
                  ? "היה הראשון לפתוח דיון!"
                  : "הקטגוריה עדיין ריקה."}
            </EmptyDescription>
          </EmptyHeader>
          {canWrite && !search && !tag && (
            <EmptyContent>
              <Button asChild>
                <Link href="/app/forums/create">
                  <PlusCircle />
                  צור נושא ראשון
                </Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </Section>
  );
}
