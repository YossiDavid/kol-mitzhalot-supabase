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
import { contactErrorMessage } from "@/features/shadchanim/lib/contact";
import {
  getOrCreateDmRoom,
  sendChatMessage,
} from "@/features/students/components/message-button";

const CHAT_MESSAGE_MAX_LENGTH = 4000;

type MessageShadchanButtonProps = {
  shadchanId: string;
  /** שורת פתיחה שמזהה לשדכן על איזו הצעה מדובר */
  contextLine: string;
};

/**
 * פתיחת צ'אט עם השדכן מתוך ההצעה - אותו מנגנון כמו "פניה למנהל הכרטיס"
 * (get_or_create_dm_room), כדי שהשיחה תמשיך בעמוד הצ'אטים הרגיל.
 */
export default function MessageShadchanButton({
  shadchanId,
  contextLine,
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
        const roomId = await getOrCreateDmRoom(shadchanId);
        await sendChatMessage(roomId, `${contextLine}\n\n${body}`);
        setOpen(false);
        router.push(`/app/chats/${roomId}`);
      } catch (err) {
        // למשל daily_contact_limit_reached מהטריגר על chat_rooms
        toast.error(contactErrorMessage(err));
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
      <DialogContent dir="rtl" className="sm:max-w-[500px]">
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
