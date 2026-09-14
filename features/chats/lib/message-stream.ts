// בניית זרם ההודעות לתצוגה: מפרידי יום וקיבוץ הודעות רצופות של אותו שולח.

import type { Message } from "@/app/app/chats/types";
import { formatDayLabel, isSameCalendarDay } from "./format-time";

/** חלון העריכה של הודעה — אותו כלל שהיה קיים, רק במקום אחד. */
export const EDIT_WINDOW_MS = 7 * 60 * 1000;

/** הודעות של אותו שולח במרווח קצר מזה מקובצות לבועה רציפה אחת. */
const GROUP_GAP_MS = 5 * 60 * 1000;

export type StreamItem =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: Message;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

export function canEditMessage(m: Message, uid: string | null): boolean {
  if (!uid || m.sender_id !== uid) return false;
  return Date.now() - new Date(m.created_at).getTime() <= EDIT_WINDOW_MS;
}

function continuesGroup(prev: Message, next: Message): boolean {
  if (prev.sender_id !== next.sender_id) return false;
  if (!isSameCalendarDay(prev.created_at, next.created_at)) return false;
  const gap =
    new Date(next.created_at).getTime() - new Date(prev.created_at).getTime();
  return gap <= GROUP_GAP_MS;
}

export function buildMessageStream(
  messages: Message[],
  now = new Date(),
): StreamItem[] {
  return messages.flatMap((message, i): StreamItem[] => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const startsDay =
      !prev || !isSameCalendarDay(prev.created_at, message.created_at);

    const messageItem: StreamItem = {
      kind: "message",
      key: message.message_id,
      message,
      isFirstInGroup: startsDay || !continuesGroup(prev, message),
      isLastInGroup: !next || !continuesGroup(message, next),
    };

    if (!startsDay) return [messageItem];
    return [
      {
        kind: "day",
        key: `day-${message.message_id}`,
        label: formatDayLabel(message.created_at, now),
      },
      messageItem,
    ];
  });
}
