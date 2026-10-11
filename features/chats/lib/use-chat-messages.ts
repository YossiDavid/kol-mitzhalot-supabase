"use client";

import * as React from "react";
import { toast } from "sonner";

import type { Message } from "@/app/app/chats/types";
import { createClient } from "@/lib/supabase/client";
import {
  CHAT_PAGE_SIZE,
  applyInsert,
  applyLatestPage,
  applyOlderPage,
  applyUpdate,
  emptyThread,
  olderThanFilter,
  splitPage,
  type ThreadState,
} from "./message-page";

const LOAD_FAILED_MESSAGE = "שגיאה בטעינת ההודעות";
const LOAD_OLDER_FAILED_MESSAGE = "שגיאה בטעינת ההודעות הקודמות";

/**
 * הודעות חדר אחד: ה-N האחרונות בפתיחה, "טעינת הודעות קודמות" לפי דרישה, ו-
 * realtime להודעות חדשות ולעריכות. הודעה שמגיעה גם מעמוד שנשלף וגם מ-realtime
 * מופיעה פעם אחת (לפי message_id).
 */
export function useChatMessages(roomId: string, currentUserId: string | null) {
  const supabase = React.useMemo(() => createClient(), []);
  const [thread, setThread] = React.useState<ThreadState>(() =>
    emptyThread(roomId),
  );
  const [isLoadingOlder, setIsLoadingOlder] = React.useState(false);
  const isLoadingOlderRef = React.useRef(false);

  // מצב של חדר אחר (לפני שהחדר החדש נטען) נחשב ריק
  const current = thread.roomId === roomId ? thread : emptyThread(roomId);
  const currentRef = React.useRef(current);
  const activeRoomRef = React.useRef(roomId);
  React.useEffect(() => {
    currentRef.current = current;
    activeRoomRef.current = roomId;
  }, [current, roomId]);

  const update = React.useCallback(
    (change: (state: ThreadState) => ThreadState) => {
      setThread((prev) =>
        change(prev.roomId === roomId ? prev : emptyThread(roomId)),
      );
    },
    [roomId],
  );

  React.useEffect(() => {
    if (!currentUserId) return;
    let isMounted = true;

    async function fetchLatest() {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .order("message_id", { ascending: false })
        .limit(CHAT_PAGE_SIZE + 1);
      if (!isMounted) return;
      if (error) {
        toast.error(LOAD_FAILED_MESSAGE);
        update((state) => applyLatestPage(state, splitPage([])));
        return;
      }
      update((state) =>
        applyLatestPage(state, splitPage((data ?? []) as Message[])),
      );
    }

    void fetchLatest();

    const channel = supabase
      .channel(`messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Message;
            update((state) => applyInsert(state, row));
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as Message;
            update((state) => applyUpdate(state, row));
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId, supabase, update]);

  /** טוען עוד עמוד של הודעות ישנות יותר מהישנה שנטענה. מחזיר אם נוספו הודעות */
  const loadOlder = React.useCallback(async (): Promise<boolean> => {
    const oldest = currentRef.current.messages[0];
    if (!oldest || isLoadingOlderRef.current) return false;

    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .or(olderThanFilter(oldest))
        .order("created_at", { ascending: false })
        .order("message_id", { ascending: false })
        .limit(CHAT_PAGE_SIZE + 1);
      if (error) {
        toast.error(LOAD_OLDER_FAILED_MESSAGE);
        return false;
      }
      // החדר הוחלף בזמן הבקשה: התשובה שייכת לחדר שנסגר
      if (activeRoomRef.current !== roomId) return false;
      const page = splitPage((data ?? []) as Message[]);
      update((state) => applyOlderPage(state, page));
      return true;
    } catch {
      toast.error(LOAD_OLDER_FAILED_MESSAGE);
      return false;
    } finally {
      isLoadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [roomId, supabase, update]);

  return {
    messages: current.messages,
    isLoading: !current.isLoaded,
    hasOlder: current.hasOlder,
    isLoadingOlder,
    olderLoads: current.olderLoads,
    loadOlder,
  };
}
