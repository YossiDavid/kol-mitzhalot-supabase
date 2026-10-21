"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { ADMIN_EXCLUSIVE_ACTION_LABEL } from "@/features/students/lib/card-approval";

/**
 * "אישור להצעות ממני בלבד": הכרטיס מאושר, אבל אינו מופיע במאגר לשדכנים. רק
 * מנהל מערכת רואה אותו, מסמן אותו בכוכב ושולח עליו הצעות. בעל הכרטיס רואה
 * "מאושר". דורש אישור לפני הביצוע.
 */
export function CardExclusiveApprovalButton({
  studentName,
  isDisabled,
  onConfirm,
}: {
  studentName: string;
  isDisabled: boolean;
  /** true = הצליח; false = נכשל (הקורא כבר הציג את השגיאה) */
  onConfirm: () => Promise<boolean>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={isDisabled}
        aria-label={`${ADMIN_EXCLUSIVE_ACTION_LABEL}: ${studentName}`}
      >
        {ADMIN_EXCLUSIVE_ACTION_LABEL}
      </Button>
      <ConfirmDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="אישור להצעות ממך בלבד"
        description={`הכרטיס של ${studentName} יאושר, אבל לא יופיע במאגר: שדכנים לא יראו אותו ולא יוכלו להציע עליו. רק את/ה תוכל/י לסמן אותו בכוכב, להעלות אותו ללוח העבודה ולשלוח עליו הצעות. בעל הכרטיס יראה שהכרטיס אושר.`}
        confirmLabel="אישור להצעות ממני בלבד"
        pendingLabel="מאשר..."
        isDestructive={false}
        onConfirm={onConfirm}
      />
    </>
  );
}
