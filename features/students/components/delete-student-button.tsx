"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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

/**
 * דיאלוג האישור למחיקת כרטיס, נשלט מבחוץ. הופרד מהכפתור כדי שגם פריט
 * בתפריט הפעולות של הכרטיס יוכל לפתוח אותו - פריט תפריט נסגר עם הבחירה
 * ואינו יכול להחזיק דיאלוג בעצמו.
 */
export function StudentDeleteDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
  onDeleted,
  redirectTo,
}: {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  /** יעד ניווט אחרי מחיקה. נדרש בעמוד הכרטיס עצמו, שכבר לא יהיה נגיש למנהל. */
  redirectTo?: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/students/${studentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "שגיאה במחיקת הכרטיס");
        return;
      }
      toast.success("הכרטיס נמחק");
      onOpenChange(false);
      onDeleted?.();
      // מהכרטיס עצמו חייבים לנווט החוצה — הוא כבר לא נגיש אחרי המחיקה
      if (redirectTo) {
        router.push(redirectTo as never);
        return;
      }
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("שגיאה במחיקת הכרטיס");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>מחיקת כרטיס</DialogTitle>
          <DialogDescription>
            הכרטיס של <strong>{studentName}</strong> יוסר מהמערכת ולא יופיע עוד
            ברשימות ובחיפושים. הנתונים והיסטוריית ההצעות שלו נשמרים במערכת ולא
            נמחקים לצמיתות.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            ביטול
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "מוחק..." : "מחק כרטיס"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** כפתור מחיקה עצמאי (שורה בטבלת המיועדים) - פותח את אותו דיאלוג */
export default function DeleteStudentButton({
  studentId,
  studentName,
  variant = "button",
  onDeleted,
  redirectTo,
}: {
  studentId: string;
  studentName: string;
  variant?: "icon" | "button";
  onDeleted?: () => void;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive"
          aria-label="מחיקת כרטיס"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      ) : (
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" />
          מחיקת כרטיס
        </Button>
      )}
      <StudentDeleteDialog
        studentId={studentId}
        studentName={studentName}
        open={open}
        onOpenChange={setOpen}
        onDeleted={onDeleted}
        redirectTo={redirectTo}
      />
    </>
  );
}
