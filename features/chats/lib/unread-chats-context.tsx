"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { countUnreadRooms, parseUnreadRoomRows } from "./unread-rooms";

/** רצף הודעות (או הודעה + סימון קריאה) מתאחד לשאילתה אחת. */
const REFETCH_DEBOUNCE_MS = 400;

/**
 * השורה שלי בכל שיחה, עם ההודעה האחרונה של השיחה. ה-FK נקוב בשמו כי בין
 * chat_rooms ל-chat_messages יש שני קשרים (room_id ו-last_message_id).
 */
const UNREAD_ROOMS_SELECT =
  "room_id, last_read_at, room:chat_rooms!inner(last_message:chat_messages!chat_rooms_last_message_fk(sender_id, created_at))";

type UnreadChatsValue = {
  /** מספר השיחות שיש בהן הודעה שלא נקראה */
  count: number;
  /** טעינה מחדש (מרוסנת) — למשל אחרי סימון שיחה כנקראה */
  refresh: () => void;
};

const NO_PROVIDER: UnreadChatsValue = { count: 0, refresh: () => {} };

const UnreadChatsContext = React.createContext<UnreadChatsValue | null>(null);

/**
 * מקור אחד לספירה, ברמת מעטפת האפליקציה: הסיידבר והסרגל התחתון קוראים
 * ממנו, כך שיש ערוץ realtime אחד ולא ערוץ לכל פריט ניווט.
 *
 * chat_room_participants אינו בפרסום ה-realtime, ולכן קריאה שנעשתה בדפדפן
 * הזה מדווחת דרך refresh, וקריאה במכשיר אחר נקלטת בחזרה ללשונית.
 */
export function UnreadChatsProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [count, setCount] = React.useState(0);
  // רק התשובה לבקשה האחרונה נקבעת — תשובה ישנה שהגיעה באיחור נזרקת
  const requestSeqRef = React.useRef(0);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async () => {
    if (!userId) return;
    const seq = ++requestSeqRef.current;

    const { data, error } = await supabase
      .from("chat_room_participants")
      .select(UNREAD_ROOMS_SELECT)
      .eq("user_id", userId)
      // אותה נראות כמו ברשימת השיחות: שיחה שנמחקה אינה נספרת
      .is("deleted_before", null)
      .is("hidden_at", null);

    if (seq !== requestSeqRef.current) return;
    if (error) {
      // התג ממשיך להציג את הערך האחרון; הודעת שגיאה על תג ניווט רק מפריעה
      console.error("[chats/unread-count]", error);
      return;
    }
    setCount(countUnreadRooms(parseUnreadRoomRows(data), userId));
  }, [supabase, userId]);

  const refresh = React.useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void load();
    }, REFETCH_DEBOUNCE_MS);
  }, [load]);

  React.useEffect(() => {
    if (!userId) return;

    // הטעינה הראשונה עוברת גם היא דרך הריסון, ומתאחדת עם הטעינה שאחרי
    // ההרשמה לערוץ אם זו מגיעה מהר
    refresh();

    // RLS מצמצם את האירועים להודעות בשיחות שלי. הודעה שאני שלחתי לא
    // משנה את הספירה.
    const channel = supabase
      .channel(`unread-chats:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as { sender_id?: string };
          if (row.sender_id === userId) return;
          refresh();
        },
      )
      .subscribe((status) => {
        // הודעה שנכנסה בין הטעינה הראשונה להרשמה לא תגיע כאירוע
        if (status === "SUBSCRIBED") refresh();
      });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, load, refresh]);

  const value = React.useMemo(() => ({ count, refresh }), [count, refresh]);

  return (
    <UnreadChatsContext.Provider value={value}>
      {children}
    </UnreadChatsContext.Provider>
  );
}

/** מחוץ לספק (כרטיס ציבורי בלי התחברות) — אפס, ו-refresh שאינו עושה דבר. */
export function useUnreadChats(): UnreadChatsValue {
  return React.useContext(UnreadChatsContext) ?? NO_PROVIDER;
}
