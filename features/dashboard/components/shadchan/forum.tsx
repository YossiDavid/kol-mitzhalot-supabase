import { Box } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { postPreview } from "@/features/forums/lib/format";
import { MessageSquareMore } from "lucide-react";
import Link from "next/link";

import { SectionLoadFailed } from "../section-load-failed";

type ForumPost = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

export default function Forum({
  posts,
  failed = false,
}: {
  posts: ForumPost[];
  /** השליפה נכשלה: מציגים הודעת שגיאה ולא "אין הודעות" */
  failed?: boolean;
}) {
  if (failed) return <SectionLoadFailed title="לא הצלחנו לטעון את הפורום" />;

  if (posts.length === 0) {
    return (
      <Empty size="compact">
        <EmptyHeader>
          <EmptyTitle>עדיין אין הודעות בפורום השדכנים</EmptyTitle>
          <EmptyDescription>מה דעתך לכתוב את ההודעה הראשונה?</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/app/forums">
              <MessageSquareMore />
              לפורום
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  // שורות מופרדות בקו בתוך Box אחד (כמו מסגרת הרשימות האחרות), בלי מסגרת לכל שורה
  return (
    <Box className="divide-y divide-border overflow-hidden p-0">
      {posts.slice(0, 3).map((post) => (
        <Link
          key={post.id}
          href={`/app/forums/${post.id}` as never}
          className="block p-4 text-right transition hover:bg-muted/50"
          dir="rtl"
        >
          <p className="text-body-sm leading-snug font-semibold">
            {post.title}
          </p>
          <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">
            {postPreview(post.content)}
          </p>
        </Link>
      ))}
    </Box>
  );
}
