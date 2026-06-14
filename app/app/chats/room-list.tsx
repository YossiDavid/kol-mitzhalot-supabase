"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Box } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";
import type { Room } from "./types";

function formatTime(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const diffDays = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0)
    return date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (diffDays < 7) return `${diffDays} ימים`;
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

const RoomRow = React.memo(function RoomRow({
  room,
  active,
}: {
  room: Room;
  active: boolean;
}) {
  const initials = room.title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/app/chats/${room.room_id}`}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-4 transition",
        active ? "bg-slate-100" : "hover:bg-muted/60",
      )}
    >
      <Avatar className="size-9 shrink-0">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium">{room.title}</div>
          {room.lastAt && (
            <div className="text-muted-foreground shrink-0 text-xs">
              {room.lastAt}
            </div>
          )}
        </div>
        {room.lastMessage && (
          <div className="text-muted-foreground truncate text-xs">
            {room.lastMessage.length > 50
              ? `${room.lastMessage.substring(0, 50)}...`
              : room.lastMessage}
          </div>
        )}
      </div>
    </Link>
  );
});

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
          if (isMounted) setRooms([]);
          return;
        }

        const roomsWithDetails: Room[] = await Promise.all(
          (roomsData || []).map(async (room) => {
            const otherUserId = room.user_a === uid ? room.user_b : room.user_a;

            // Fetch user metadata and last message in parallel
            const [userMetaResult, lastMsgResult] = await Promise.all([
              supabase
                .rpc("get_user_metadata", { target_user_id: otherUserId })
                .catch(() => ({ data: null })),
              room.last_message_id
                ? supabase
                    .from("chat_messages")
                    .select("content, created_at")
                    .eq("message_id", room.last_message_id)
                    .single()
                : Promise.resolve({ data: null }),
            ]);

            const userData = userMetaResult.data;
            let otherUserName = otherUserId.substring(0, 8);
            if (userData?.firstName || userData?.lastName) {
              otherUserName =
                `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
            } else if (userData?.email) {
              otherUserName = userData.email.split("@")[0];
            }

            const lastMsg = lastMsgResult.data;
            return {
              room_id: room.room_id,
              title: otherUserName,
              lastMessage: lastMsg?.content ?? null,
              lastAt: lastMsg ? formatTime(lastMsg.created_at) : null,
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
          const updated = payload.new as any;
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
              lastAt = formatTime(lastMsg.created_at);
            }
          }

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
              .toSorted((a, b) => (b.lastAt ? 1 : 0) - (a.lastAt ? 1 : 0)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, supabase, rooms]);

  const activeRoomId = pathname.startsWith("/app/chats/")
    ? pathname.slice("/app/chats/".length)
    : null;

  return (
    <Box
      asChild
      className="my-4 h-[calc(100%-2rem)] p-0 md:rounded-l-none md:inset-shadow-[10px_0_10px_-10px_rgba(0,0,0,0.1)]"
    >
      <aside>
        <div className="flex h-14 items-center px-4">
          <div className="text-sm font-semibold">צ׳אטים</div>
        </div>
        <Separator />
        <ScrollArea className="h-[calc(100%-56px)]">
          {loading ? (
            <div className="text-muted-foreground p-4 text-center text-sm">
              טוען...
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-muted-foreground p-4 text-center text-sm">
              אין צ׳אטים
            </div>
          ) : (
            rooms.map((r) => (
              <RoomRow
                key={r.room_id}
                room={r}
                active={r.room_id === activeRoomId}
              />
            ))
          )}
        </ScrollArea>
      </aside>
    </Box>
  );
}
