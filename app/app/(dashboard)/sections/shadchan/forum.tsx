import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { MessageSquare, PlusCircle } from "lucide-react";
import Link from "next/link";

export type ForumPost = {
  id: string;
  title: string;
  author_name: string;
  replies_count: number;
  created_at: string;
};

export default function Forum({
  forums,
  canWrite,
}: {
  forums: ForumPost[];
  canWrite?: boolean;
}) {
  return (
    <>
      {forums.length > 0 ? (
        <div className="space-y-3">
          {forums.map((post) => (
            <Link
              key={post.id}
              href={`/app/forums/${post.id}`}
              className="hover:bg-muted flex items-start justify-between rounded-lg border p-4 transition"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{post.title}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {post.author_name} ·{" "}
                  {new Date(post.created_at).toLocaleDateString("he-IL")}
                </p>
              </div>
              <span className="text-muted-foreground ms-4 flex shrink-0 items-center gap-1 text-xs">
                <MessageSquare className="h-3 w-3" />
                {post.replies_count}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>עדיין אין הודעות בפורום השדכנים</EmptyTitle>
            <EmptyDescription>
              {canWrite
                ? "מה דעתך לכתוב את הנושא הראשון?"
                : "הפורום עדיין ריק."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href={canWrite ? "/app/forums/create" : "/app/forums"}>
                {canWrite ? (
                  <>
                    <PlusCircle />
                    פתח נושא ראשון
                  </>
                ) : (
                  <>
                    <MessageSquare />
                    לפורום
                  </>
                )}
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
