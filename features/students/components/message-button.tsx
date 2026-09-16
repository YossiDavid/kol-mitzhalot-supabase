"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export async function messageCardAuthor(params: {
  authorId: string;
  content: string;
}) {
  const roomId = await getOrCreateDmRoom(params.authorId);
  await sendChatMessage(roomId, params.content);
  return roomId;
}

/**
 * דיאלוג "פניה למנהל הכרטיס". נשלט מבחוץ (`open`/`onOpenChange`) כי מי שפותח
 * אותו הוא פריט בתפריט הפעולות של הכרטיס - פריט תפריט נסגר עם הבחירה, ולכן
 * אינו יכול להחזיק את הדיאלוג בעצמו.
 */
export function StudentMessageDialog({
  authorId,
  open,
  onOpenChange,
}: {
  authorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const messageId = useId();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = message.trim();
    if (!content) {
      toast.error("יש לכתוב הודעה");
      return;
    }

    startTransition(async () => {
      try {
        const roomId = await messageCardAuthor({ authorId, content });
        setMessage("");
        onOpenChange(false);
        router.push(`/app/chats/${roomId}`);
      } catch (error) {
        console.error(error);
        toast.error("שליחת הפנייה נכשלה, נסו שוב");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>שליחת פנייה</DialogTitle>
            <DialogDescription>שליחת פנייה למנהל הכרטיס.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={messageId}>הודעה</Label>
            <Textarea
              id={messageId}
              name="message"
              placeholder="הודעה"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "שולח..." : "שליחה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
