"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRoomInfo } from "../lib/use-room-info";
import { ChatThread } from "./chat-thread";

/**
 * שרשור של חדר קיים, מוטמע בעמוד אחר (למשל הצעת שידוך): אותם הודעות ואותו
 * שדה כתיבה כמו בחלון הצ'אט, בגובה קבוע, עם קישור לפתיחה בצ'אט המלא.
 */
export function EmbeddedChat({ roomId }: { roomId: string }) {
  const info = useRoomInfo(roomId);

  return (
    <div className="space-y-2">
      <div className="flex h-96 flex-col overflow-hidden rounded-lg border border-border">
        <ChatThread
          roomId={roomId}
          currentUserId={info.currentUserId}
          otherName={info.title}
          otherAvatarUrl={info.avatarUrl}
          className="min-h-0 flex-1"
        />
      </div>
      <Button asChild variant="link" className="h-auto p-0">
        <Link href={`/app/chats/${roomId}`}>
          <ExternalLink />
          פתיחה בצ&apos;אט המלא
        </Link>
      </Button>
    </div>
  );
}
