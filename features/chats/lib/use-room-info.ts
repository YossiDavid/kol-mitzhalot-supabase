"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/user-role";
import { parseRoomContext, type RoomContext } from "./room-context";
import {
  getAvatarUrl,
  getDisplayName,
  type UserMetadata,
} from "./user-display";

export type RoomInfo = {
  currentUserId: string | null;
  otherUserId: string | null;
  /** שם הצד השני; null עד שנטען */
  title: string | null;
  avatarUrl: string | null;
  context: RoomContext | null;
  /** שדכן/מנהל: רשאי לראות כרטיסים של הצד השני (תפריט "כרטיסי המשתמש") */
  isStaffViewer: boolean;
};

const EMPTY_INFO: RoomInfo = {
  currentUserId: null,
  otherUserId: null,
  title: null,
  avatarUrl: null,
  context: null,
  isStaffViewer: false,
};

/**
 * מי אני, מי הצד השני וההקשר של החדר. חדר שהמידע עליו עוד לא נטען (או
 * שהוחלף) מחזיר מידע ריק — כך אין הבזק של שם החדר הקודם.
 */
export function useRoomInfo(roomId: string): RoomInfo {
  const supabase = React.useMemo(() => createClient(), []);
  const [loaded, setLoaded] = React.useState<{
    roomId: string;
    info: RoomInfo;
  } | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!isMounted || !user) return;

      const { data: room } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("room_id", roomId)
        .single();
      if (!room || !isMounted) return;

      const otherUserId: string =
        room.user_a === user.id ? room.user_b : room.user_a;
      const base: RoomInfo = {
        currentUserId: user.id,
        otherUserId,
        title: null,
        avatarUrl: null,
        context: parseRoomContext(room),
        isStaffViewer: hasRole(user, "shadchan") || hasRole(user, "admin"),
      };

      try {
        const { data } = await supabase.rpc("get_user_metadata", {
          target_user_id: otherUserId,
        });
        if (!isMounted) return;
        const metadata = data as UserMetadata;
        setLoaded({
          roomId,
          info: {
            ...base,
            title: getDisplayName(metadata),
            avatarUrl: getAvatarUrl(metadata),
          },
        });
      } catch {
        if (!isMounted) return;
        setLoaded({ roomId, info: { ...base, title: getDisplayName(null) } });
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [roomId, supabase]);

  return loaded?.roomId === roomId ? loaded.info : EMPTY_INFO;
}
