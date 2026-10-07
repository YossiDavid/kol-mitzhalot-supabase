"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  openContextRoom,
  openRoomErrorMessage,
} from "@/features/chats/lib/open-room";
import { createClient } from "@/lib/supabase/client";

export async function getOrCreateDmRoom(otherUserId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_or_create_dm_room", {
    other_user_id: otherUserId,
  });

  if (error) throw error;
  // data is the uuid room_id
  return data as string;
}

export async function sendChatMessage(roomId: string, content: string) {
  const supabase = createClient();

  // you can omit sender_id by fetching auth.uid() first,
  // but easiest is to read it and set it explicitly.
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) throw userErr;
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("chat_messages").insert({
    room_id: roomId,
    sender_id: user.id,
    content,
  });

  if (error) throw error;
}

/** פרמטר הכתובת שמבקש מחלון הצ'אט להעביר פוקוס לשדה הכתיבה. */
export const COMPOSE_QUERY = "compose=1";

const DISABLED_REASON = "הכרטיס הוצא משידוכים, ולכן אי אפשר לפנות בצ'אט";

/**
 * כפתור "צ'אט" בהדר הכרטיס: פתיחה (או שליפה) של שרשור הכרטיס מול מנהל
 * הכרטיס ומעבר ישיר אליו, בלי הודעה ראשונה. ההרשאה ומכסת הפניות היומית
 * נאכפות בשרת (get_or_create_context_room); כאן רק מציגים את השגיאה.
 */
export function StudentChatButton({
  authorId,
  studentId,
  isDisabled = false,
}: {
  authorId: string;
  studentId: string;
  /** הכרטיס הוצא משידוכים */
  isDisabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const roomId = await openContextRoom(authorId, {
          kind: "student",
          studentId,
        });
        router.push(`/app/chats/${roomId}?${COMPOSE_QUERY}`);
      } catch (error) {
        console.error(error);
        toast.error(openRoomErrorMessage(error));
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isDisabled || isPending}
      title={isDisabled ? DISABLED_REASON : undefined}
      aria-label={isDisabled ? `צ'אט - ${DISABLED_REASON}` : "צ'אט"}
    >
      <MessageSquare className="h-4 w-4" />
      {isPending ? "פותח..." : "צ'אט"}
    </Button>
  );
}
