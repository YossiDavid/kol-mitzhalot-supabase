"use client";

import { useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  openContextRoom,
  openRoomErrorMessage,
} from "@/features/chats/lib/open-room";
import { COMPOSE_QUERY } from "@/features/students/components/message-button";

/**
 * "שליחת הודעה" מדף המשתמש בניהול: פותח (או מחזיר) שיחה כללית עם המשתמש -
 * גם למי שנרשם ועדיין לא מילא כרטיס. ההרשאה נבדקת בשרת
 * (get_or_create_context_room).
 */
export function AdminUserChatButton({
  userId,
  size = "default",
}: {
  userId: string;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const roomId = await openContextRoom(userId, { kind: "general" });
        router.push(`/app/chats/${roomId}?${COMPOSE_QUERY}` as Route);
      } catch (error) {
        console.error("[admin/user-chat] open room failed", error);
        toast.error(openRoomErrorMessage(error));
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleClick}
      disabled={isPending}
      data-testid="admin-user-chat"
    >
      <MessageSquare />
      {isPending ? "פותח שיחה..." : size === "sm" ? "צ'אט" : "שליחת הודעה"}
    </Button>
  );
}
