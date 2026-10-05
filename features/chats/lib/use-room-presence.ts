"use client";

import * as React from "react";

import { createClient } from "@/lib/supabase/client";

/** האם הצד השני מחובר לחדר הזה כרגע (Realtime presence). */
export function useRoomPresence(
  roomId: string,
  currentUserId: string | null,
  otherUserId: string | null,
): boolean {
  const supabase = React.useMemo(() => createClient(), []);
  const [onlineIds, setOnlineIds] = React.useState<ReadonlySet<string>>(
    new Set(),
  );

  React.useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: currentUserId } },
    });

    const syncPresence = () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ user_id: string }>
      >;
      const ids = new Set<string>();
      Object.values(state).forEach((entries) =>
        entries.forEach((p) => ids.add(p.user_id)),
      );
      setOnlineIds(ids);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: currentUserId });
          syncPresence();
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setOnlineIds(new Set());
    };
  }, [roomId, currentUserId, supabase]);

  return otherUserId ? onlineIds.has(otherUserId) : false;
}
