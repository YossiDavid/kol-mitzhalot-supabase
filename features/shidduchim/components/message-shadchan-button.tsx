"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  openContextRoom,
  openRoomErrorMessage,
} from "@/features/chats/lib/open-room";
import { sendChatMessage } from "@/features/students/components/message-button";

const CHAT_MESSAGE_MAX_LENGTH = 4000;

type MessageShadchanButtonProps = {
  shadchanId: string;
  /** ההצעה שעליה השיחה: החדר נפתח כשרשור ההצעה, בלי שורת הקשר בטקסט */
  shidduchId: string;
};

/**
 * פתיחת צ'אט עם השדכן מתוך ההצעה: פותח את חדר ההקשר של ההצעה
 * (get_or_create_context_room, shidduch), כך שהצ'אט עצמו יודע על איזו הצעה
 * מדובר והשיחה ממשיכה בעמוד הצ'אטים הרגיל.
 */
export default function MessageShadchanButton({
  shadchanId,
  shidduchId,
}: MessageShadchanButtonProps) {
  const router = useRouter();
  const messageId = useId();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const send = () => {
    const body = message.trim();
    if (!body) {
      toast.error("יש לכתוב הודעה");
      return;
    }

    startTransition(async () => {
      try {
        const roomId = await openContextRoom(shadchanId, {
          kind: "shidduch",
          shidduchId,
        });
        await sendChatMessage(roomId, body);
        setOpen(false);
        router.push(`/app/chats/${roomId}`);
      } catch (err) {
        // למשל daily_contact_limit_reached מהטריגר על chat_rooms
        toast.error(openRoomErrorMessage(err));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare />
          שליחת הודעה לשדכן
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>שליחת הודעה לשדכן</DialogTitle>
          <DialogDescription>
            ההודעה תישלח בצ&apos;אט, ותוכלו להמשיך את השיחה בעמוד הצ&apos;אטים.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={messageId}>הודעה</Label>
          <Textarea
            id={messageId}
            rows={4}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isPending}
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            ביטול
          </Button>
          <Button type="button" onClick={send} disabled={isPending}>
            {isPending ? "שולח..." : "שליחה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
