"use client";

import { useRoomInfo } from "../lib/use-room-info";
import { useRoomPresence } from "../lib/use-room-presence";
import { ChatHeader } from "./chat-header";
import { ChatThread } from "./chat-thread";
import { RoomContextBar } from "./room-context-bar";

/** חלון השיחה המלא: כותרת, הקשר החדר (קישור לכרטיס/הצעה) והשרשור. */
export function ChatView({
  roomId,
  shouldFocusComposer = false,
}: {
  roomId: string;
  /** נפתח מכפתור "צ'אט": הפוקוס עובר ישר לשדה הכתיבה */
  shouldFocusComposer?: boolean;
}) {
  const info = useRoomInfo(roomId);
  const isOnline = useRoomPresence(
    roomId,
    info.currentUserId,
    info.otherUserId,
  );

  return (
    <section
      aria-label={info.title ? `שיחה עם ${info.title}` : "שיחה"}
      className="flex h-full min-h-0 flex-col"
    >
      <ChatHeader
        title={info.title}
        avatarUrl={info.avatarUrl}
        isOnline={isOnline}
      />

      {info.context && info.otherUserId && (
        <RoomContextBar
          context={info.context}
          otherUserId={info.otherUserId}
          isStaffViewer={info.isStaffViewer}
        />
      )}

      <ChatThread
        roomId={roomId}
        currentUserId={info.currentUserId}
        otherName={info.title}
        otherAvatarUrl={info.avatarUrl}
        className="min-h-0 flex-1"
        shouldFocusComposer={shouldFocusComposer}
      />
    </section>
  );
}
