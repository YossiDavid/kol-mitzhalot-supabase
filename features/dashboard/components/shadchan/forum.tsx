import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { MessageSquareMore } from "lucide-react";
import Link from "next/link";

type ForumPost = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export default function Forum({ posts }: { posts: ForumPost[] }) {
  if (posts.length === 0) {
    return (
      <Empty>
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
        <div key={post.id} className="rounded-lg border p-3 text-right" dir="rtl">
          <p className="font-semibold text-body-sm leading-snug">{post.title}</p>
          <p className="text-muted-foreground mt-1 text-caption line-clamp-2">
            {post.body}
          </p>
        </div>
      ))}
      <div className="pt-1">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/forums">לכל הפוסטים</Link>
        </Button>
      </div>
    </div>
  );
}
