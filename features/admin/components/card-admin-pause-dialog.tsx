"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * אישור להשהיית כרטיס / ביטול השהיה ע"י הנהלה, מתפריט הפעולות של הכרטיס.
 * משתמש באותו נתיב כמו הכפתור בטבלת הילדים (admin-pause); ההרשאה נאכפת שם.
 */
export function CardAdminPauseDialog({
  studentId,
  studentName,
  isPaused,
  open,
  onOpenChange,
}: {
  studentId: string;
  studentName: string;
  isPaused: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  async function handleConfirm(): Promise<boolean> {
    const res = await fetch(`/api/v1/students/${studentId}/admin-pause`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: !isPaused }),
    });
    if (!res.ok) {
      toast.error("עדכון ההשהיה נכשל");
      return false;
    }
    toast.success(isPaused ? "ההשהיה בוטלה" : "הכרטיס הושהה");
    return true;
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isPaused ? "ביטול השהיית הכרטיס" : "השהיית הכרטיס"}
      description={
        isPaused ? (
          <>
            הכרטיס של <strong>{studentName}</strong> יחזור לשידוכים (אלא אם הוא
            מאורס או נשוי).
          </>
        ) : (
          <>
            הכרטיס של <strong>{studentName}</strong> יוצא משידוכים, ומנהל הכרטיס
            לא יוכל להחזיר אותו עד לביטול ההשהיה. הצעות קיימות אינן מושפעות.
          </>
        )
      }
      confirmLabel={isPaused ? "ביטול השהיה" : "השהה כרטיס"}
      pendingLabel="מעדכן..."
      isDestructive={!isPaused}
      onConfirm={handleConfirm}
      onSuccess={() => router.refresh()}
      onError={(error) => {
        console.error(error);
        toast.error("עדכון ההשהיה נכשל");
      }}
    />
  );
}
