import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { MessageSquare, Pin, PlusCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export default async function ForumsPage() {
  noStore();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.user_metadata?.role;
  const canWrite = role === "admin" || role === "shadchan";

  const { data: posts } = await supabase
    .from("forum_posts")
    .select(`id, title, content, is_pinned, created_at, author_id, forum_replies(count)`)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

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

  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">פורום השדכנים</h1>
        {canWrite && (
          <Button asChild>
            <Link href="/app/forums/create">
              <PlusCircle />
              נושא חדש
            </Link>
          </Button>
        )}
      </div>

      {posts && posts.length > 0 ? (
        <div className="mt-6 space-y-3">
          {posts.map((post) => {
            const repliesCount =
              (post.forum_replies as unknown as { count: number }[])?.[0]
                ?.count ?? 0;

            return (
              <Link
                key={post.id}
                href={`/app/forums/${post.id}`}
                className="hover:bg-muted flex items-start gap-3 rounded-lg border p-4 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {post.is_pinned && (
                      <Pin className="text-primary h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate text-base font-semibold">
                      {post.title}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {post.content}
                  </p>
                  <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                    <span>{authorNames[post.author_id]}</span>
                    <span>·</span>
                    <span>
                      {new Date(post.created_at).toLocaleDateString("he-IL")}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {repliesCount} תגובות
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyTitle>עדיין אין נושאים בפורום</EmptyTitle>
            <EmptyDescription>
              {canWrite
                ? "היה הראשון לפתוח דיון!"
                : "הפורום עדיין ריק. חכו לפוסטים מהשדכנים."}
            </EmptyDescription>
          </EmptyHeader>
          {canWrite && (
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
