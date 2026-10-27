"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createClient } from "@/lib/supabase/client";
import type { Room } from "@/app/app/chats/types";
import {
  getAvatarUrl,
  getDisplayName,
  type UserMetadata,
} from "../lib/user-display";
import {
  byLastAtDesc,
  groupRoomsByPerson,
  isPlainGeneralGroup,
} from "../lib/group-rooms";
import {
  ROOM_FILTER_LABELS,
  ROOM_FILTERS,
  filterRooms,
  type RoomFilter,
} from "../lib/filter-rooms";
import { parseRoomContext } from "../lib/room-context";
import { useUnreadChats } from "../lib/unread-chats-context";
import { ChatEmptyState } from "./chat-empty-state";
import { PersonGroup } from "./person-group";
import { RoomRow, RoomRowSkeleton } from "./room-row";

const SKELETON_ROWS = 6;

type RoomChangePayload = {
  room_id?: string;
  last_message_id?: string | null;
};

export function RoomList() {
  const supabase = createClient();
  const pathname = usePathname();
  // אותו מקור כמו התג בניווט — ערוץ realtime אחד לשניהם
  const { unreadRoomIds } = useUnreadChats();

  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);

  // Fetch user + rooms in a single pass — no extra render cycle waterfall
  React.useEffect(() => {
    let isMounted = true;

    async function init() {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id ?? null;
      if (!isMounted) return;
      if (!uid) {
        setLoading(false);
        return;
      }
      setCurrentUserId(uid);

      try {
        const { data: participants, error: participantsError } = await supabase
          .from("chat_room_participants")
          .select("room_id")
          .eq("user_id", uid)
          .is("deleted_before", null);

        if (participantsError || !participants?.length) {
          if (participantsError) toast.error("שגיאה בטעינת הצ'אטים");
          if (isMounted) setRooms([]);
          return;
        }

        const roomIds = participants.map((p) => p.room_id);

        const { data: roomsData, error: roomsError } = await supabase
          .from("chat_rooms")
          .select("*")
          .in("room_id", roomIds)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (roomsError) {
          toast.error("שגיאה בטעינת הצ'אטים");
          if (isMounted) setRooms([]);
          return;
        }

        const roomsWithDetails: Room[] = await Promise.all(
          (roomsData || []).map(async (room) => {
            const otherUserId = room.user_a === uid ? room.user_b : room.user_a;

            // Fetch user metadata and last message in parallel
            const [userMetaResult, lastMsgResult] = await Promise.all([
              Promise.resolve(
                supabase.rpc("get_user_metadata", {
                  target_user_id: otherUserId,
                }),
              ).catch(() => ({ data: null })),
              room.last_message_id
                ? supabase
                    .from("chat_messages")
                    .select("content, created_at")
                    .eq("message_id", room.last_message_id)
                    .single()
                : Promise.resolve({ data: null }),
            ]);

            const userData = userMetaResult.data as UserMetadata;
            const otherUserName = getDisplayName(userData);
            const lastMsg = lastMsgResult.data;
            const context = parseRoomContext(room);

            return {
              room_id: room.room_id,
              title: otherUserName,
              lastMessage: lastMsg?.content ?? null,
              lastAt: lastMsg?.created_at ?? null,
              avatarUrl: getAvatarUrl(userData),
              other_user_id: otherUserId,
              other_user_name: otherUserName,
              contextKind: context.kind,
              studentId: context.studentId,
              shidduchId: context.shidduchId,
              contextLabel: context.label,
            };
          }),
        );

        if (isMounted) setRooms(roomsWithDetails);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void init();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // Realtime room updates
  React.useEffect(() => {
    if (!currentUserId || !rooms.length) return;

    // O(1) lookup instead of .some() scan on every realtime event
    const roomIdSet = new Set(rooms.map((r) => r.room_id));

    const channel = supabase
      .channel(`rooms:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_rooms" },
        async (payload) => {
          const updated = payload.new as RoomChangePayload;
          if (!updated?.room_id || !roomIdSet.has(updated.room_id)) return;

          let lastMessage: string | null = null;
          let lastAt: string | null = null;
          if (updated.last_message_id) {
            const { data: lastMsg, error } = await supabase
              .from("chat_messages")
              .select("content, created_at")
              .eq("message_id", updated.last_message_id)
              .maybeSingle();
            if (!error && lastMsg) {
              lastMessage = lastMsg.content;
              lastAt = lastMsg.created_at;
            }
          }

          // מיון לפי זמן ההודעה האחרונה בפועל. קודם המיון היה לפי עצם
          // קיומו של lastAt, כך ששיחה שקיבלה הודעה לא עלתה לראש הרשימה.
          setRooms((prev) =>
            prev
              .map((r) =>
                r.room_id === updated.room_id
                  ? {
                      ...r,
                      lastMessage: lastMessage ?? r.lastMessage,
                      lastAt: lastAt ?? r.lastAt,
                    }
                  : r,
              )
              // sort על המערך החדש של map; toSorted אינו קיים בכרום 109
              .sort(byLastAtDesc),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase, rooms]);

  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<RoomFilter>("all");
  const allGroupsCount = React.useMemo(
    () => groupRoomsByPerson(rooms).length,
    [rooms],
  );
  const groups = React.useMemo(
    () =>
      groupRoomsByPerson(filterRooms(rooms, { query, filter, unreadRoomIds })),
    [rooms, query, filter, unreadRoomIds],
  );

  const activeRoomId = pathname.startsWith("/app/chats/")
    ? pathname.slice("/app/chats/".length)
    : null;

  return (
    <aside aria-label="רשימת הצ'אטים" className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <h1 className="text-subtitle font-bold text-foreground">צ'אטים</h1>
        {!loading && allGroupsCount > 0 && (
          <span className="rounded-full bg-primary-muted px-2 py-0.5 text-caption font-semibold text-primary tabular-nums">
            {allGroupsCount}
            <span className="sr-only"> שיחות</span>
          </span>
        )}
      </div>

      {!loading && rooms.length > 0 && (
        <div className="flex shrink-0 flex-col gap-2 border-b border-border p-2">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש לפי שם, כרטיס או הודעה"
            aria-label="חיפוש בצ'אטים"
          />
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(next) => {
              // לחיצה על הסינון הפעיל מחזירה ל"הכל" במקום להשאיר בלי בחירה
              setFilter(
                (ROOM_FILTERS as readonly string[]).includes(next)
                  ? (next as RoomFilter)
                  : "all",
              );
            }}
            aria-label="סינון הצ'אטים"
            className="w-full"
          >
            {ROOM_FILTERS.map((value) => (
              <ToggleGroupItem key={value} value={value} className="flex-1">
                {ROOM_FILTER_LABELS[value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {/* Radix עוטף את התוכן ב-div עם display:table, שמתרחב לרוחב התוכן
          ולא נעצר ברוחב החלונית. בלי הביטול הזה שורה עם הודעה ארוכה גולשת
          החוצה במקום להיחתך ב-truncate, והסימון שבסופה יוצא מהמסך. */}
      <ScrollArea className="min-h-0 flex-1 [&>[data-slot=scroll-area-viewport]>div]:!block">
        {loading ? (
          <div
            role="status"
            aria-label="טוען צ'אטים"
            className="flex flex-col gap-1 p-2"
          >
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <RoomRowSkeleton key={i} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <ChatEmptyState variant="no-rooms" className="py-14" />
        ) : groups.length === 0 ? (
          <ChatEmptyState variant="no-matches" className="py-14" />
        ) : (
          <ul className="flex flex-col gap-1 p-2">
            {groups.map((group) => (
              <li key={group.otherUserId}>
                {isPlainGeneralGroup(group) ? (
                  <RoomRow
                    room={group.rooms[0]}
                    isActive={group.rooms[0].room_id === activeRoomId}
                    isUnread={unreadRoomIds.has(group.rooms[0].room_id)}
                  />
                ) : (
                  <PersonGroup
                    group={group}
                    activeRoomId={activeRoomId}
                    unreadRoomIds={unreadRoomIds}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
