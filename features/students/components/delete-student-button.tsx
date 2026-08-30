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
  DialogTrigger,
} from "@/components/ui/dialog";

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
  /** יעד ניווט אחרי מחיקה. נדרש בעמוד הכרטיס עצמו, שכבר לא יהיה נגיש למנהל. */
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      onDeleted?.();
      // מהכרטיס עצמו חייבים לנווט החוצה — הוא כבר לא נגיש אחרי המחיקה
      if (redirectTo) {
        router.push(redirectTo as never);
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <button
            type="button"
            className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive"
            aria-label="מחיקת כרטיס"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        ) : (
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" />
            מחיקת כרטיס
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl">
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
            onClick={() => setOpen(false)}
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
