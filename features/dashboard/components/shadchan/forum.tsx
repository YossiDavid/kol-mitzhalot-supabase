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
  if (failed) {
    return (
      <Empty size="compact">
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

  return (
    <div className="space-y-3">
      {posts.slice(0, 3).map((post) => (
        <Link
          key={post.id}
          href={`/app/forums/${post.id}` as never}
          className="block rounded-lg border p-3 text-right hover:bg-muted/50"
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
      <div className="pt-1">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/forums">לכל הפוסטים</Link>
        </Button>
      </div>
    </div>
  );
}
