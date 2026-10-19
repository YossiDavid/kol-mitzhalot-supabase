"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REPLY_MAX_LENGTH,
  type ReplyRouteResponse,
  type SubmissionReply,
} from "@/features/contact-submissions/lib/submission-model";

type SubmissionReplyFormProps = {
  submissionId: string;
  recipientEmail: string;
  onReplied: (reply: SubmissionReply) => void;
};

const FIELD_ID = "submission-reply-body";

/** הודעה למנהל לפי מה שקרה בפועל למייל */
function reportResult(result: ReplyRouteResponse, email: string) {
  if (result.emailSent) {
    toast.success(`התשובה נשלחה ל-${email}`);
  } else if (result.skipped) {
    toast.info("התשובה נשמרה. בסביבת הפיתוח המייל לא נשלח בפועל");
  } else {
    toast.error("התשובה נשמרה, אך המייל לא נשלח לפונה. נסו שוב מאוחר יותר");
  }
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return typeof data?.error === "string" ? data.error : "שליחת התשובה נכשלה";
}

/**
 * מענה לפונה מתוך חלון הפנייה: התשובה נשלחת במייל מהשרת ונשמרת בהיסטוריה.
 */
export function SubmissionReplyForm({
  submissionId,
  recipientEmail,
  onReplied,
}: SubmissionReplyFormProps) {
  const [body, setBody] = useState("");
  const [isPending, setIsPending] = useState(false);
  const isEmpty = body.trim() === "";

  async function handleSubmit() {
    if (isEmpty || isPending) return;
    setIsPending(true);
    try {
      const res = await fetch(
        `/api/v1/admin/contact-submissions/${submissionId}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      const result = (await res.json()) as ReplyRouteResponse;
      reportResult(result, recipientEmail);
      setBody("");
      onReplied(result.reply);
    } catch {
      toast.error("שליחת התשובה נכשלה, נסו שוב");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="space-y-2 border-t pt-4" aria-label="מענה לפונה">
      <Label htmlFor={FIELD_ID}>תשובה לפונה ({recipientEmail})</Label>
      <Textarea
        id={FIELD_ID}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={REPLY_MAX_LENGTH}
        rows={5}
        disabled={isPending}
        placeholder="כתבו כאן את התשובה. היא תישלח במייל יחד עם ציטוט הפנייה"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-muted-foreground">
          {body.length}/{REPLY_MAX_LENGTH}
        </span>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isEmpty || isPending}
        >
          <Send className="me-1 h-4 w-4" />
          {isPending ? "שולח..." : "שליחת תשובה"}
        </Button>
      </div>
    </section>
  );
}
