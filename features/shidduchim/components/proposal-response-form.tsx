"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RESPONSE_MESSAGE_MAX_LENGTH,
  SHIDDUCH_RESPONSE_LABELS,
  SHIDDUCH_RESPONSE_VALUES,
  type ShidduchResponse,
  type ShidduchSide,
} from "@/features/shidduchim/lib/responses";

type ProposalResponseFormProps = {
  shidduchId: string;
  side: ShidduchSide;
  currentResponse: ShidduchResponse | null;
  currentMessage: string | null;
  /** נקרא אחרי שמירה מוצלחת - למשל לסגירת דיאלוג */
  onSubmitted?: () => void;
};

function readApiError(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return null;
  }
  return typeof data.error === "string" ? data.error : null;
}

export default function ProposalResponseForm({
  shidduchId,
  side,
  currentResponse,
  currentMessage,
  onSubmitted,
}: ProposalResponseFormProps) {
  const router = useRouter();
  const messageId = useId();
  const [selected, setSelected] = useState<ShidduchResponse | null>(
    currentResponse,
  );
  const [message, setMessage] = useState(currentMessage ?? "");
  const [isPending, startTransition] = useTransition();

  const isUnchanged =
    selected === currentResponse &&
    message.trim() === (currentMessage ?? "").trim();

  const submit = () => {
    if (!selected) {
      toast.error("יש לבחור תגובה");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/shidduchim/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shidduchId,
            side,
            response: selected,
            message,
          }),
        });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(readApiError(data) ?? "שליחת התגובה נכשלה");
          return;
        }
        toast.success("התגובה נשלחה לשדכן");
        onSubmitted?.();
        router.refresh();
      } catch {
        toast.error("שליחת התגובה נכשלה");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="התגובה שלכם להצעה"
        className="flex flex-wrap gap-2"
      >
        {SHIDDUCH_RESPONSE_VALUES.map((value) => {
          const isSelected = selected === value;
          return (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              variant={isSelected ? "default" : "outline"}
              onClick={() => setSelected(value)}
              disabled={isPending}
            >
              {SHIDDUCH_RESPONSE_LABELS[value]}
            </Button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label htmlFor={messageId}>הודעה לשדכן (לא חובה)</Label>
        <Textarea
          id={messageId}
          rows={3}
          maxLength={RESPONSE_MESSAGE_MAX_LENGTH}
          placeholder="למשל: אילו פרטים נוספים חשוב לכם לדעת"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isPending}
        />
      </div>

      <Button
        type="button"
        onClick={submit}
        disabled={isPending || !selected || isUnchanged}
      >
        {isPending
          ? "שולח..."
          : currentResponse
            ? "עדכון התגובה"
            : "שליחת תגובה לשדכן"}
      </Button>
    </div>
  );
}
