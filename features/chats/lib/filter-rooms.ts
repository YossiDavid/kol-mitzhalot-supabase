// חיפוש וסינון ברשימת הצ'אטים. נעשה על החדרים לפני הקיבוץ לפי אדם, כך שאדם
// מוצג עם השרשורים שמתאימים בלבד.

import type { Room } from "@/app/app/chats/types";

export const ROOM_FILTERS = ["all", "unread", "student", "shidduch"] as const;
export type RoomFilter = (typeof ROOM_FILTERS)[number];

export const ROOM_FILTER_LABELS: Record<RoomFilter, string> = {
  all: "הכל",
  unread: "לא נקראו",
  student: "על כרטיס",
  shidduch: "על הצעה",
};

function normalize(text: string | null | undefined): string {
  return (text ?? "").trim().toLocaleLowerCase("he");
}

function matchesFilter(
  room: Room,
  filter: RoomFilter,
  unreadRoomIds: ReadonlySet<string>,
): boolean {
  if (filter === "unread") return unreadRoomIds.has(room.room_id);
  if (filter === "student" || filter === "shidduch") {
    return room.contextKind === filter;
  }
  return true;
}

/** שם הצד השני, שם הכרטיס/ההצעה או ההודעה האחרונה מכילים את החיפוש */
function matchesQuery(room: Room, query: string): boolean {
  if (!query) return true;
  return [room.other_user_name, room.contextLabel, room.lastMessage].some(
    (field) => normalize(field).includes(query),
  );
}

export function filterRooms(
  rooms: readonly Room[],
  options: {
    query: string;
    filter: RoomFilter;
    unreadRoomIds: ReadonlySet<string>;
  },
): Room[] {
  const query = normalize(options.query);
  return rooms.filter(
    (room) =>
      matchesFilter(room, options.filter, options.unreadRoomIds) &&
      matchesQuery(room, query),
  );
}
