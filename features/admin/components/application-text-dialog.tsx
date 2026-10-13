"use client";

import { useState } from "react";

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

type ApplicationTextDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fieldLabel: string;
  submitLabel: string;
  pendingLabel: string;
  maxLength: number;
  /** true = חובה למלא טקסט (אחרי trim) לפני שליחה */
  isRequired: boolean;
  isDestructive?: boolean;
  /** מחזיר הודעת שגיאה בעברית, או null כשהצליח (הדיאלוג נסגר) */
  onSubmit: (text: string) => Promise<string | null>;
};

/**
 * דיאלוג עם שדה טקסט חופשי לפעולות מנהל על בקשת הצטרפות: דחייה (סיבה חובה),
 * אישור (הודעה אופציונלית) ושליחת הודעה (חובה). הטקסט נחתך ב-trim ומוגבל באורך.
 * בזמן שליחה הדיאלוג נעול.
 */
export function ApplicationTextDialog({
  open,
  onOpenChange,
  title,
  description,
  fieldLabel,
  submitLabel,
  pendingLabel,
  maxLength,
  isRequired,
  isDestructive = false,
  onSubmit,
}: ApplicationTextDialogProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const trimmed = text.trim();
  const isMissingRequired = isRequired && trimmed.length === 0;

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) {
      setText("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (isMissingRequired) return;
    setIsPending(true);
    setError(null);
    const failure = await onSubmit(trimmed);
    setIsPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="application-text-dialog-field">{fieldLabel}</Label>
          <Textarea
            id="application-text-dialog-field"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={maxLength}
            rows={5}
            disabled={isPending}
            aria-invalid={error ? true : undefined}
          />
          <p className="text-body-sm text-muted-foreground">
            {text.length}/{maxLength}
          </p>
          {error && (
            <p role="alert" className="text-body-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            ביטול
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={isPending || isMissingRequired}
          >
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
