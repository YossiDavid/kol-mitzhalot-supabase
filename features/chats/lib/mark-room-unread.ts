"use client";

import * as React from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { useUnreadChats } from "./unread-chats-context";

/**
 * "סימון כלא נקרא" הוא סימון עצמי - "לטיפול בהמשך" - ולכן הוא חייב לעבוד
 * גם בשיחה שאני שלחתי בה אחרון. מצב כזה אינו ניתן לגזירה מ-last_read_at,
 * ומכאן העמודה marked_unread_at: היא הסימון המפורש, ו-isRoomUnread מכבד
 * אותה בלי קשר לזהות השולח.
 *
 * העדכון מאפס גם את last_read_at, כדי שפתיחת השיחה תנקה את שניהם במסלול
 * אחד: useMarkRoomRead מעדכן רק כשהחותמת ריקה או ישנה מההודעה האחרונה.
 *
 * participants_update_self_only מתנה רק auth.uid() = user_id, בלי תנאי על
 * הערכים, ולכן העדכון מותר.
 */

/**
 * שיחה שכבר מסומנת אין טעם לסמן שוב, ובשיחה בלי הודעות אין מה לטפל בהמשך -
 * וגם לא היה מי שינקה את הסימון, כי הניקוי תלוי בקיומה של הודעה אחרונה.
 */
export function canMarkRoomUnread({
  hasMessages,
  isUnread,
}: {
  hasMessages: boolean;
  isUnread: boolean;
}): boolean {
  return hasMessages && !isUnread;
}

export function useMarkRoomUnread(): (roomId: string) => Promise<void> {
  const supabase = React.useMemo(() => createClient(), []);
  const { refresh } = useUnreadChats();

  return React.useCallback(
    async (roomId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;

      const { error } = await supabase
        .from("chat_room_participants")
        .update({
          marked_unread_at: new Date().toISOString(),
          last_read_at: null,
        })
        .eq("room_id", roomId)
        .eq("user_id", userId);

      if (error) {
        console.error("[chats/mark-unread]", error);
        toast.error("לא הצלחנו לסמן את השיחה כלא נקראה");
        return;
      }
      toast.success("השיחה סומנה כלא נקראה");
      refresh();
    },
    [supabase, refresh],
  );
}
