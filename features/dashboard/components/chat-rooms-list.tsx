"use client";

import Link from "next/link";

import { Box } from "@/components/layout";
import { cn } from "@/lib/utils";
import { UnreadRoomDot } from "@/features/chats/components/unread-room-dot";
import { formatRoomTime } from "@/features/chats/lib/format-time";
import { useUnreadChats } from "@/features/chats/lib/unread-chats-context";
import { unreadRoomLabel } from "@/features/chats/lib/unread-rooms";

/** כרטיס שיחה בדשבורד, כפי שדף הדשבורד בונה אותו */
export type DashboardChat = {
  id: string;
  name: string;
  image: string;
  lastMessage?: string | null;
  lastMessageTime?: string | null;
  lastMessageSender?: string | null;
};

/**
 * רשימת השיחות האחרונות בדשבורד, משותפת לכרטיס השדכן ולכרטיס ההורה —
 * ביניהם נבדלים רק המצב הריק והכותרת שמעליהם.
 *
 * הסימון "לא נקרא" מגיע מאותו מקור כמו התג בניווט (unread-chats-context),
 * ולכן הוא מתעדכן ב-realtime ומתנקה ברגע שהשיחה נפתחת — בלי שאילתה נוספת.
 */
export function DashboardChatRooms({ chats }: { chats: DashboardChat[] }) {
  const { unreadRoomIds } = useUnreadChats();

  return (
    <Box className="space-y-4">
      {chats.map((chat) => {
        const isUnread = unreadRoomIds.has(chat.id);
        const time = formatRoomTime(chat.lastMessageTime ?? null);

        return (
          <Link
            key={chat.id}
            href={`/app/chats/${chat.id}`}
            aria-label={isUnread ? unreadRoomLabel(chat.name) : undefined}
            data-unread={isUnread ? "true" : undefined}
            className={cn(
              "group flex items-center rounded-lg border p-4 transition hover:bg-muted",
              isUnread && "border-primary/40 bg-primary-muted/40",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={chat.image || "/placeholder-avatar.png"}
              alt=""
              className="me-4 h-10 w-10 rounded-full border"
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "truncate text-body",
                    isUnread ? "font-bold" : "font-medium",
                  )}
                >
                  {chat.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-caption tabular-nums",
                    isUnread
                      ? "font-semibold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {time}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "min-w-0 flex-1 truncate text-body-sm",
                    isUnread
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {/* פרטי השולח + תוכן ההודעה האחרונה */}
                  {chat.lastMessageSender && (
                    <span className="font-semibold">
                      {chat.lastMessageSender}:{" "}
                    </span>
                  )}
                  {chat.lastMessage ?? (
                    <span className="italic">אין הודעות עדיין</span>
                  )}
                </div>
                {isUnread && <UnreadRoomDot />}
              </div>
            </div>
          </Link>
        );
      })}
    </Box>
  );
}
