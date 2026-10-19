"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  REJECTION_REASON_MAX_LENGTH,
  REJECTION_REASON_MIN_LENGTH,
} from "@/features/students/lib/card-approval";

export type CardRejection = { reason: string; silent: boolean };

/**
 * דחיית כרטיס על ידי מנהל: סיבה (חובה), שנשלחת לבעל הכרטיס בהתראה ובמייל.
 * "ללא שליחת הודעה לבעל הכרטיס" - אין התראה ואין מייל, והסיבה הופכת לרשות.
 * בזמן שליחה הדיאלוג נעול.
 */
export function CardRejectDialog({
  open,
  onOpenChange,
  studentName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  /** מחזיר הודעת שגיאה בעברית, או null כשהצליח (הדיאלוג נסגר) */
  onSubmit: (rejection: CardRejection) => Promise<string | null>;
}) {
  const fieldId = useId();
  const silentId = useId();
  const [reason, setReason] = useState("");
  const [isSilent, setIsSilent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const trimmed = reason.trim();
  const isReasonMissing =
    !isSilent && trimmed.length < REJECTION_REASON_MIN_LENGTH;

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) {
      setReason("");
      setIsSilent(false);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (isReasonMissing) return;
    setIsPending(true);
    setError(null);
    const failure = await onSubmit({ reason: trimmed, silent: isSilent });
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
          <DialogTitle>דחיית הכרטיס</DialogTitle>
          <DialogDescription>
            {isSilent
              ? `הכרטיס של ${studentName} לא יוצג לשדכנים. בעל הכרטיס לא יקבל התראה או מייל על הדחייה.`
              : `הכרטיס של ${studentName} לא יוצג לשדכנים. הסיבה תישלח לבעל הכרטיס בהתראה ובמייל, והוא יוכל לתקן ולשלוח לאישור מחדש.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={fieldId}>
            {isSilent ? "סיבת הדחייה (רשות)" : "סיבת הדחייה (חובה)"}
          </Label>
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REJECTION_REASON_MAX_LENGTH}
            rows={5}
            disabled={isPending}
            aria-invalid={error ? true : undefined}
          />
          <p className="text-body-sm text-muted-foreground">
            {reason.length}/{REJECTION_REASON_MAX_LENGTH}
          </p>
          <div className="flex items-center gap-2">
            <Checkbox
              id={silentId}
              checked={isSilent}
              onCheckedChange={(checked) => setIsSilent(checked === true)}
              disabled={isPending}
            />
            <Label htmlFor={silentId}>ללא שליחת הודעה לבעל הכרטיס</Label>
          </div>
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
            variant="destructive"
            onClick={handleSubmit}
            disabled={isPending || isReasonMissing}
          >
            {isPending ? "דוחה..." : "דחיית הכרטיס"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
