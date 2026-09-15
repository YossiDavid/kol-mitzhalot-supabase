"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ContactQuotaNote from "@/features/shadchanim/components/contact-quota-note";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  contactErrorMessage,
  getContactAvailability,
} from "@/features/shadchanim/lib/contact";
import type { ContactQuota } from "@/features/shadchanim/lib/types";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

type ContactShadchanDialogProps = {
  shadchanId: string;
  shadchanName: string;
  quota: ContactQuota | null;
  triggerClassName?: string;
};

/** "פניה לשדכן": opens a chat with the shadchan via contact_shadchan, which enforces the daily limit. */
export default function ContactShadchanDialog({
  shadchanId,
  shadchanName,
  quota,
  triggerClassName,
}: ContactShadchanDialogProps) {
  const router = useRouter();
  const messageId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const availability = getContactAvailability(quota, shadchanId);
  const isBlocked = availability?.kind === "limit_reached";
  const trimmedMessage = message.trim();
  const canSubmit = !isBlocked && !isSending && trimmedMessage.length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSending(true);
    setErrorText(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("contact_shadchan", {
        p_shadchan_id: shadchanId,
        p_message: trimmedMessage,
      });

      if (error || typeof data !== "string") {
        const text = contactErrorMessage(error);
        setErrorText(text);
        toast.error(text);
        // המכסה השתנתה מאז שהעמוד נטען (למשל פנייה מלשונית אחרת) - נרענן את המונה
        if (error?.message === "daily_contact_limit_reached") router.refresh();
        return;
      }

      toast.success("הפנייה נשלחה לשדכן");
      setIsOpen(false);
      setMessage("");
      router.push(`/app/chats/${data}` as Route);
    } catch (err) {
      console.error("[shadchanim/contact]", err);
      const text = contactErrorMessage(null);
      setErrorText(text);
      toast.error(text);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          פניה לשדכן
          <MessageSquare />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>פניה ל{shadchanName}</DialogTitle>
            <DialogDescription>
              ההודעה תישלח בצ׳אט, והשדכן יקבל התראה על הפנייה.
            </DialogDescription>
          </DialogHeader>

          <ContactQuotaNote availability={availability} />

          <div className="grid gap-2">
            <Label htmlFor={messageId}>הודעה</Label>
            <Textarea
              id={messageId}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="כמה מילים על הילד/ה ועל מה שאתם מחפשים"
              maxLength={CONTACT_MESSAGE_MAX_LENGTH}
              disabled={isBlocked || isSending}
              rows={5}
            />
            {errorText && (
              <p className="text-body-sm text-destructive" role="alert">
                {errorText}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ביטול
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {isSending ? "שולח…" : "שליחת פנייה"}
            </Button>
          </DialogFooter>
          {isBlocked && (
            <p className="text-body-sm text-muted-foreground">
              כפתור השליחה חסום עד מחר, כי מכסת הפניות היומית נוצלה.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
