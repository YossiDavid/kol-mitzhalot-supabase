"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  const router = useRouter();

  async function handleDelete(): Promise<boolean> {
    const res = await fetch(`/api/v1/admin/students/${studentId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "שגיאה במחיקת הכרטיס");
      return false;
    }
    toast.success("הכרטיס נמחק");
    return true;
  }

  // רץ אחרי שהדיאלוג נסגר
  function handleDeleted() {
    onDeleted?.();
    // מהכרטיס עצמו חייבים לנווט החוצה — הוא כבר לא נגיש אחרי המחיקה
    if (redirectTo) {
      router.push(redirectTo as never);
      return;
    }
    router.refresh();
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="מחיקת כרטיס"
      description={
        <>
          הכרטיס של <strong>{studentName}</strong> יוסר מהמערכת ולא יופיע עוד
          ברשימות ובחיפושים. הנתונים והיסטוריית ההצעות שלו נשמרים במערכת ולא
          נמחקים לצמיתות.
        </>
      }
      confirmLabel="מחק כרטיס"
      pendingLabel="מוחק..."
      onConfirm={handleDelete}
      onSuccess={handleDeleted}
      onError={(error) => {
        console.error(error);
        toast.error("שגיאה במחיקת הכרטיס");
      }}
    />
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
