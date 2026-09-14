"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatAvatar } from "./chat-avatar";

type ChatHeaderProps = {
  title: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
};

/** כותרת חלון השיחה — נשארת קבועה מעל אזור ההודעות הנגלל. */
export function ChatHeader({ title, avatarUrl, isOnline }: ChatHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-3 md:px-4">
      {/* במובייל מוצג חלון אחד בכל פעם — החץ מחזיר לרשימה */}
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="-ms-1 shrink-0 rounded-full text-muted-foreground md:hidden"
      >
        <Link href="/app/chats" aria-label="חזרה לרשימת הצ׳אטים">
          <ArrowRight className="size-5" />
        </Link>
      </Button>

      <div className="relative shrink-0">
        <ChatAvatar name={title ?? ""} src={avatarUrl} className="size-10" />
        {isOnline && (
          <span
            aria-hidden="true"
            className="absolute end-0 bottom-0 size-3 rounded-full bg-primary ring-2 ring-card"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {title ? (
          <h2 className="truncate text-body font-bold text-foreground">
            {title}
          </h2>
        ) : (
          <Skeleton className="mb-1 h-5 w-32" />
        )}
        <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              isOnline ? "bg-primary" : "bg-muted-foreground",
            )}
          />
          {isOnline ? "מחובר" : "לא מחובר"}
        </p>
      </div>
    </header>
  );
}
