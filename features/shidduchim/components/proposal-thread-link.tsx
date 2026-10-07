"use client";

import * as React from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UnreadRoomDot } from "@/features/chats/components/unread-room-dot";
import { useUnreadChats } from "@/features/chats/lib/unread-chats-context";
import {
  PROPOSAL_THREAD_ANCHOR,
  proposalThreadAnchor,
} from "@/features/shidduchim/lib/proposal-thread-anchor";
import { createClient } from "@/lib/supabase/client";

type ThreadRoom = { roomId: string; otherUserId: string };

/**
 * "לשיחה על ההצעה": קישור בשורת ההצעה ברשימות, עם נקודה כשיש בשרשור הודעה
 * שלא נקראה. פותח את ההצעה כשהשרשור בתצוגה (עוגן ב-hash). החדרים נשלפים
 * תחת ה-RLS שלי, ולכן רואים רק שרשורים שאני חבר בהם.
 */
export default function ProposalThreadLink({
  shidduchId,
}: {
  shidduchId: string;
}) {
  const { unreadRoomIds } = useUnreadChats();
  const [rooms, setRooms] = React.useState<ThreadRoom[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function load() {
      const [{ data: auth }, { data }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("chat_rooms")
          .select("room_id, user_a, user_b")
          .eq("context_kind", "shidduch")
          .eq("shidduch_id", shidduchId),
      ]);
      const me = auth.user?.id;
      if (!isMounted || !me) return;
      setRooms(
        (data ?? []).map((room) => ({
          roomId: room.room_id as string,
          otherUserId: (room.user_a === me
            ? room.user_b
            : room.user_a) as string,
        })),
      );
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [shidduchId]);

  const unreadRoom = rooms.find((room) => unreadRoomIds.has(room.roomId));
  const anchor = unreadRoom
    ? proposalThreadAnchor(unreadRoom.otherUserId)
    : PROPOSAL_THREAD_ANCHOR;

  return (
    <Button asChild variant="outline" size="sm" className="relative">
      <Link
        href={`/app/shidduchim/${shidduchId}#${anchor}`}
        data-unread={unreadRoom ? "true" : undefined}
        aria-label={
          unreadRoom ? "לשיחה על ההצעה, הודעה שלא נקראה" : "לשיחה על ההצעה"
        }
      >
        <MessagesSquare aria-hidden="true" />
        לשיחה על ההצעה
        {unreadRoom && <UnreadRoomDot />}
      </Link>
    </Button>
  );
}
