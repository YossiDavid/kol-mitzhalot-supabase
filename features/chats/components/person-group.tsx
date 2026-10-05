"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRoomTime } from "../lib/format-time";
import type { PersonGroup as PersonGroupData } from "../lib/group-rooms";
import { unreadRoomLabel } from "../lib/unread-rooms";
import { ChatAvatar } from "./chat-avatar";
import { RoomRow } from "./room-row";

/**
 * אדם אחד ברשימת הצ'אטים, ומתחתיו השרשורים איתו (כללי / כרטיס / הצעה), לכל
 * אחד ההודעה האחרונה והסימון שלו. שורת האדם מסכמת: ההודעה האחרונה מכל
 * השרשורים ומספר השרשורים שלא נקראו.
 *
 * ברירת המחדל: פתוח כשיש שרשור שלא נקרא או שהשיחה הפעילה בתוכו, וסגור
 * אחרת. לחיצה על השורה מחליפה, וההחלטה של המשתמש גוברת.
 */
export function PersonGroup({
  group,
  activeRoomId,
  unreadRoomIds,
}: {
  group: PersonGroupData;
  activeRoomId: string | null;
  unreadRoomIds: ReadonlySet<string>;
}) {
  const unreadCount = group.rooms.filter((r) =>
    unreadRoomIds.has(r.room_id),
  ).length;
  const hasActive = group.rooms.some((r) => r.room_id === activeRoomId);
  const [override, setOverride] = React.useState<boolean | null>(null);
  const isOpen = override ?? (unreadCount > 0 || hasActive);
  const listId = React.useId();
  const time = formatRoomTime(group.lastAt);
  const hasUnread = unreadCount > 0;

  return (
    <div data-testid="person-group" data-person-id={group.otherUserId}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={
          hasUnread
            ? `${unreadRoomLabel(group.name)}, ${unreadCount} שרשורים`
            : group.name
        }
        onClick={() => setOverride(!isOpen)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChatAvatar
          name={group.name}
          src={group.avatarUrl}
          className="size-11"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-body-sm text-foreground",
                hasUnread ? "font-bold" : "font-semibold",
              )}
            >
              {group.name}
            </span>
            {time && group.lastAt && (
              <time
                dateTime={group.lastAt}
                className={cn(
                  "shrink-0 text-caption tabular-nums",
                  hasUnread
                    ? "font-semibold text-primary"
                    : "text-muted-foreground",
                )}
              >
                {time}
              </time>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-caption text-muted-foreground">
              {group.rooms.length} שיחות
              {group.lastMessage ? ` · ${group.lastMessage}` : ""}
            </p>
            {hasUnread && (
              <span
                aria-hidden="true"
                data-slot="person-unread-count"
                className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-caption font-semibold text-primary-foreground tabular-nums"
              >
                {unreadCount}
              </span>
            )}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </div>
        </div>
      </button>

      <ul id={listId} hidden={!isOpen} className="flex flex-col gap-0.5">
        {group.rooms.map((room) => (
          <li key={room.room_id}>
            <RoomRow
              room={room}
              variant="thread"
              isActive={room.room_id === activeRoomId}
              isUnread={unreadRoomIds.has(room.room_id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
