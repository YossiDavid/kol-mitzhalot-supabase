"use client";

import { useRef, useState } from "react";

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

const DEFAULT_CANCEL_LABEL = "ביטול";

type ConfirmDialogProps = {
  /** בקרה מבחוץ: open ו-onOpenChange יחד. בלעדיהם הדיאלוג שולט בעצמו */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** הכפתור שפותח את הדיאלוג (רינדור כ-asChild); חלופה ל-open/onOpenChange */
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  /** תווית כפתור האישור בזמן הביצוע, למשל "מוחק..." */
  pendingLabel: string;
  cancelLabel?: string;
  /** פעולה הרסנית (ברירת מחדל): כפתור האישור אדום */
  isDestructive?: boolean;
  /**
   * הפעולה עצמה. true = הצליחה והדיאלוג נסגר; false = נכשלה והדיאלוג נשאר
   * פתוח (הקורא כבר הציג את השגיאה). זריקה נחשבת כישלון ומועברת ל-onError.
   */
  onConfirm: () => Promise<boolean>;
  /** רץ אחרי שהדיאלוג נסגר בהצלחה (ניווט, רענון, עדכון הרשימה) */
  onSuccess?: () => void;
  /** נקרא כש-onConfirm זרק; הקורא מציג הודעה ורושם ללוג */
  onError?: (error: unknown) => void;
};

/**
 * דיאלוג אישור לפעולה הרסנית, על בסיס components/ui/dialog. בזמן הביצוע
 * הדיאלוג נשאר פתוח וננעל: הכפתורים מושבתים, ו-Escape, לחיצה בחוץ וכפתור
 * הסגירה אינם סוגרים אותו. הפוקוס נוחת על "ביטול", כדי שאישור בטעות ב-Enter
 * לא ימחק דבר.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = DEFAULT_CANCEL_LABEL,
  isDestructive = true,
  onConfirm,
  onSuccess,
  onError,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  function setOpen(next: boolean) {
    if (isPending) return;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  async function handleConfirm() {
    setIsPending(true);
    let isDone = false;
    try {
      isDone = await onConfirm();
    } catch (error: unknown) {
      onError?.(error);
    } finally {
      setIsPending(false);
    }
    if (!isDone) return;
    if (!isControlled) setInternalOpen(false);
    onOpenChange?.(false);
    onSuccess?.();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        size="sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelRef.current?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
