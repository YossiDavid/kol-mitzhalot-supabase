// קיבוץ חדרים לפי הצד השני: רשומה אחת לאדם, ומתחתיה השרשורים איתו.

import type { Room } from "@/app/app/chats/types";

export type PersonGroup = {
  otherUserId: string;
  name: string;
  avatarUrl: string | null;
  /** השרשורים של האדם, החדש ביותר ראשון */
  rooms: Room[];
  lastAt: string | null;
  lastMessage: string | null;
};

function toTime(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

/** ההודעה האחרונה ראשונה; חדרים בלי הודעות בסוף, והכללי לפני שאר הריקים. */
export function byLastAtDesc(a: Room, b: Room): number {
  const diff = toTime(b.lastAt) - toTime(a.lastAt);
  if (diff !== 0) return diff;
  return (
    Number(b.contextKind === "general") - Number(a.contextKind === "general")
  );
}

export function groupRoomsByPerson(rooms: readonly Room[]): PersonGroup[] {
  const byPerson = new Map<string, Room[]>();
  for (const room of rooms) {
    const existing = byPerson.get(room.other_user_id) ?? [];
    byPerson.set(room.other_user_id, [...existing, room]);
  }

  return [...byPerson.entries()]
    .map(([otherUserId, personRooms]): PersonGroup => {
      const sorted = personRooms.toSorted(byLastAtDesc);
      const latest = sorted[0];
      return {
        otherUserId,
        name: latest.other_user_name,
        avatarUrl: latest.avatarUrl,
        rooms: sorted,
        lastAt: latest.lastAt,
        lastMessage: latest.lastMessage,
      };
    })
    .toSorted((a, b) => toTime(b.lastAt) - toTime(a.lastAt));
}

/** אדם עם שיחה כללית אחת בלבד מוצג כשורה רגילה, בלי שרשורים. */
export function isPlainGeneralGroup(group: PersonGroup): boolean {
  return group.rooms.length === 1 && group.rooms[0].contextKind === "general";
}
