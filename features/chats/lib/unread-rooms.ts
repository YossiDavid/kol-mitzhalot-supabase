// ספירת השיחות שיש בהן הודעה שלא נקראה, לתג שליד "צ'אטים" בניווט.
//
// נספרות שיחות ולא הודעות: עשר הודעות מאותו אדם הן עדיין שיחה אחת שממתינה
// למענה, בדיוק כמו ההתראה האחת לשיחה ב-notify_chat_message.

/** מעבר לזה התג מציג "9+". המספר המדויק נשאר בשם הנגיש של הקישור. */
export const UNREAD_DISPLAY_CAP = 9;

export type UnreadRoomRow = {
  room_id: string;
  last_read_at: string | null;
  last_message: { sender_id: string; created_at: string } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseLastMessage(room: unknown): UnreadRoomRow["last_message"] {
  if (!isRecord(room) || !isRecord(room.last_message)) return null;
  const senderId = asString(room.last_message.sender_id);
  const createdAt = asString(room.last_message.created_at);
  return senderId && createdAt
    ? { sender_id: senderId, created_at: createdAt }
    : null;
}

/**
 * תשובת השאילתה מגיעה מהרשת, ולכן מאומתת כאן שורה-שורה. שורה בלי room_id
 * נזרקת; שיחה שההודעה האחרונה בה אינה גלויה לי (RLS) נחשבת בלי הודעות.
 */
export function parseUnreadRoomRows(data: unknown): UnreadRoomRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row): UnreadRoomRow[] => {
    if (!isRecord(row)) return [];
    const roomId = asString(row.room_id);
    if (!roomId) return [];
    return [
      {
        room_id: roomId,
        last_read_at: asString(row.last_read_at),
        last_message: parseLastMessage(row.room),
      },
    ];
  });
}

/** יש הודעה אחרונה, היא לא שלי, והיא חדשה מהרגע שבו קראתי את השיחה. */
export function isRoomUnread(row: UnreadRoomRow, userId: string): boolean {
  const message = row.last_message;
  if (!message || message.sender_id === userId) return false;
  if (!row.last_read_at) return true;
  return (
    new Date(message.created_at).getTime() >
    new Date(row.last_read_at).getTime()
  );
}

/**
 * מזהי השיחות שיש בהן הודעה שלא נקראה. אותו חישוב משרת גם את התג בניווט
 * (הספירה היא גודל הקבוצה) וגם את סימון השורות ברשימת השיחות ובדשבורד.
 */
export function selectUnreadRoomIds(
  rows: readonly UnreadRoomRow[],
  userId: string,
): ReadonlySet<string> {
  return new Set(
    rows.filter((row) => isRoomUnread(row, userId)).map((row) => row.room_id),
  );
}

/** קבוצות זהות בתוכן — כדי לא לרנדר מחדש רשימה שלא השתנתה. */
export function haveSameRoomIds(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

export function formatUnreadCount(count: number): string {
  return count > UNREAD_DISPLAY_CAP ? `${UNREAD_DISPLAY_CAP}+` : String(count);
}

/**
 * השם הנגיש של שורת שיחה שלא נקראה: מתחיל בשם הגלוי, ואחריו הסיבה לסימון
 * החזותי (נקודה ובולד), שאינו נמסר לקורא מסך בדרך אחרת.
 */
export function unreadRoomLabel(title: string): string {
  return `${title}, הודעה שלא נקראה`;
}

/** השם הנגיש של פריט הניווט: מתחיל בטקסט הגלוי, ואחריו מספר השיחות. */
export function unreadChatsLabel(title: string, count: number): string {
  if (count <= 0) return title;
  if (count === 1) return `${title}, שיחה אחת שלא נקראה`;
  return `${title}, ${count} שיחות שלא נקראו`;
}
