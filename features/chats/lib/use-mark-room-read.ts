"use client";

import * as React from "react";

import type { Message } from "@/app/app/chats/types";
import { createClient } from "@/lib/supabase/client";
import { useUnreadChats } from "./unread-chats-context";

function subscribeToVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

const isDocumentVisible = () => document.visibilityState === "visible";
const assumeVisibleOnServer = () => true;

/**
 * מסמן את השיחה הפתוחה כנקראה: בפתיחה, בכל הודעה שנכנסת בזמן שהיא פתוחה,
 * ובחזרה ללשונית. לשונית ברקע אינה מסמנת — ההודעה עוד לא נראתה.
 *
 * last_read_at מקבל את זמן ההודעה האחרונה כפי שנשמר בשרת, ולא את שעון
 * הדפדפן: שעון מקדים היה מסמן כנקראות הודעות שיגיעו בהמשך. ה-or מונע
 * מלשונית ישנה להחזיר את הסימון אחורה.
 */
export function useMarkRoomRead({
  roomId,
  userId,
  messages,
  isReady,
}: {
  roomId: string;
  userId: string | null;
  messages: readonly Message[];
  isReady: boolean;
}): void {
  const supabase = React.useMemo(() => createClient(), []);
  const { refresh } = useUnreadChats();
  const isVisible = React.useSyncExternalStore(
    subscribeToVisibility,
    isDocumentVisible,
    assumeVisibleOnServer,
  );
  const markedKeyRef = React.useRef<string | null>(null);

  // ההודעות ממוינות לפי created_at, והודעות realtime מצורפות בסוף
  const latest = messages.at(-1) ?? null;

  React.useEffect(() => {
    if (!isReady || !userId || !latest || !isVisible) return;

    const key = `${roomId}:${latest.message_id}`;
    if (markedKeyRef.current === key) return;
    markedKeyRef.current = key;

    async function markRead(readUpTo: string, currentUserId: string) {
      const { error } = await supabase
        .from("chat_room_participants")
        // הסימון העצמי "לטיפול בהמשך" נמחק כאן: פתיחת השיחה היא הטיפול
        .update({ last_read_at: readUpTo, marked_unread_at: null })
        .eq("room_id", roomId)
        .eq("user_id", currentUserId)
        .or(`last_read_at.is.null,last_read_at.lt."${readUpTo}"`);

      if (error) {
        // ניסיון חוזר בהודעה הבאה או בחזרה ללשונית
        markedKeyRef.current = null;
        console.error("[chats/mark-read]", error);
        return;
      }
      refresh();
    }

    void markRead(latest.created_at, userId);
  }, [isReady, userId, roomId, latest, isVisible, supabase, refresh]);
}
