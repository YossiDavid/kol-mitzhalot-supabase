"use client";

import { useId, useState } from "react";
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
import {
  ADMIN_FOCUS_NOTE_MAX_LENGTH,
  adminFocusEndpoint,
  type CardAdminFocus,
} from "@/features/students/lib/card-admin-focus";

const FOCUS_ERROR = "עדכון המיקוד נכשל";

async function saveFocus(
  studentId: string,
  body: { focused: boolean; note: string | null },
): Promise<boolean> {
  try {
    const response = await fetch(adminFocusEndpoint(studentId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * סימון "במיקוד" / עדכון ההערה / הסרת הסימון, מתפריט הפעולות של הכרטיס.
 * למנהל מערכת בלבד (ההרשאה נאכפת בנתיב admin-focus). הסימון גלוי לשדכנים
 * ולמנהלים - ברשימה ובכרטיס; לבעל הכרטיס לא נשלחת הודעה.
 */
export function CardAdminFocusDialog({
  studentId,
  studentName,
  focus,
  open,
  onOpenChange,
}: {
  studentId: string;
  studentName: string;
  focus: CardAdminFocus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const noteId = useId();
  const isFocused = focus.focusedAt !== null;
  const [note, setNote] = useState(focus.note ?? "");
  const [isPending, setIsPending] = useState(false);

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (next) setNote(focus.note ?? "");
    onOpenChange(next);
  }

  async function submit(focused: boolean) {
    setIsPending(true);
    const isSaved = await saveFocus(studentId, {
      focused,
      note: focused ? note.trim() || null : null,
    });
    setIsPending(false);
    if (!isSaved) {
      toast.error(FOCUS_ERROR);
      return;
    }
    toast.success(focused ? "הכרטיס סומן במיקוד" : "הסימון במיקוד הוסר");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isFocused ? "כרטיס במיקוד" : "סימון הכרטיס במיקוד"}
          </DialogTitle>
          <DialogDescription>
            הכרטיס של {studentName} יסומן &quot;במיקוד&quot; ברשימת המיועדים
            ובכרטיס, לעיני השדכנים והמנהלים בלבד. אפשר לצרף הערה קצרה שתוצג
            בריחוף על התג.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={noteId}>הערה (רשות)</Label>
          <Textarea
            id={noteId}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={ADMIN_FOCUS_NOTE_MAX_LENGTH}
            rows={3}
            disabled={isPending}
          />
          <p className="text-body-sm text-muted-foreground">
            {note.length}/{ADMIN_FOCUS_NOTE_MAX_LENGTH}
          </p>
        </div>
        <DialogFooter>
          {isFocused && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void submit(false)}
              disabled={isPending}
            >
              הסרת הסימון
            </Button>
          )}
          <Button
            type="button"
            onClick={() => void submit(true)}
            disabled={isPending}
          >
            {isPending ? "שומר..." : isFocused ? "שמירה" : "סימון במיקוד"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
