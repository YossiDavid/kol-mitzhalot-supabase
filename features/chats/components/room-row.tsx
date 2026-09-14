"use client";

import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Room } from "@/app/app/chats/types";
import { formatRoomTime } from "../lib/format-time";
import { ChatAvatar } from "./chat-avatar";

export const RoomRow = React.memo(function RoomRow({
  room,
  isActive,
}: {
  room: Room;
  isActive: boolean;
}) {
  const time = formatRoomTime(room.lastAt);

  return (
    <Link
      href={`/app/chats/${room.room_id}`}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        isActive ? "bg-primary-muted" : "hover:bg-muted",
      )}
    >
      {/* פס צד מסמן את השיחה הפתוחה — קריא יותר מרקע בלבד */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-3 end-0 w-1 rounded-full transition-colors",
          isActive ? "bg-primary" : "bg-transparent",
        )}
      />
      <ChatAvatar
        name={room.title}
        src={room.avatarUrl}
        className="size-11"
        fallbackClassName={
          isActive ? "bg-primary text-primary-foreground" : undefined
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-body-sm font-semibold",
              isActive ? "text-primary" : "text-foreground",
            )}
          >
            {room.title}
          </span>
          {time && room.lastAt && (
            <time
              dateTime={room.lastAt}
              className="shrink-0 text-caption text-muted-foreground tabular-nums"
            >
              {time}
            </time>
          )}
        </div>
        <p className="truncate text-caption text-muted-foreground">
          {room.lastMessage ?? "אין הודעות עדיין"}
        </p>
      </div>
    </Link>
  );
});

/** שורת שלד בזמן טעינת הרשימה — שומרת על מבנה השורה האמיתית. */
export function RoomRowSkeleton() {
  return (
    <div aria-hidden="true" className="flex items-center gap-3 px-3 py-2.5">
      <Skeleton className="size-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3 w-40 max-w-full" />
      </div>
    </div>
  );
}
