"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import type { Room } from "@/app/app/chats/types";
import {
  getAvatarUrl,
  getDisplayName,
  type UserMetadata,
} from "../lib/user-display";
import { ChatEmptyState } from "./chat-empty-state";
import { RoomRow, RoomRowSkeleton } from "./room-row";

const SKELETON_ROWS = 6;

type RoomChangePayload = {
  room_id?: string;
  last_message_id?: string | null;
};

function toTime(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

/** השיחה עם ההודעה האחרונה ביותר ראשונה; שיחות בלי הודעות בסוף. */
function byLastAtDesc(a: Room, b: Room): number {
  return toTime(b.lastAt) - toTime(a.lastAt);
}

export function RoomList() {
  const supabase = createClient();
  const pathname = usePathname();

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
          if (participantsError) toast.error("שגיאה בטעינת הצ׳אטים");
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
          toast.error("שגיאה בטעינת הצ׳אטים");
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

            return {
              room_id: room.room_id,
              title: otherUserName,
              lastMessage: lastMsg?.content ?? null,
              lastAt: lastMsg?.created_at ?? null,
              avatarUrl: getAvatarUrl(userData),
              other_user_id: otherUserId,
              other_user_name: otherUserName,
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
              .toSorted(byLastAtDesc),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase, rooms]);

  const activeRoomId = pathname.startsWith("/app/chats/")
    ? pathname.slice("/app/chats/".length)
    : null;

  return (
    <aside aria-label="רשימת הצ׳אטים" className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4">
        <h1 className="text-subtitle font-bold text-foreground">צ׳אטים</h1>
        {!loading && rooms.length > 0 && (
          <span className="rounded-full bg-primary-muted px-2 py-0.5 text-caption font-semibold text-primary tabular-nums">
            {rooms.length}
            <span className="sr-only"> שיחות</span>
          </span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div
            role="status"
            aria-label="טוען צ׳אטים"
            className="flex flex-col gap-1 p-2"
          >
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <RoomRowSkeleton key={i} />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <ChatEmptyState variant="no-rooms" className="py-14" />
        ) : (
          <ul className="flex flex-col gap-1 p-2">
            {rooms.map((r) => (
              <li key={r.room_id}>
                <RoomRow room={r} isActive={r.room_id === activeRoomId} />
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
