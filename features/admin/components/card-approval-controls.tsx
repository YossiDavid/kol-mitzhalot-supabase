"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApplicationTextDialog } from "@/features/admin/components/application-text-dialog";
import {
  CARD_APPROVAL_LABELS,
  REJECTION_REASON_MAX_LENGTH,
  type CardApprovalStatus,
} from "@/features/students/lib/card-approval";

type Props = {
  studentId: string;
  studentName: string;
  status: CardApprovalStatus;
  /** סיבת הדחייה הנוכחית, כשהכרטיס נדחה */
  rejectionReason?: string | null;
};

async function sendDecision(
  studentId: string,
  body: { action: "approve" } | { action: "reject"; reason: string },
): Promise<string | null> {
  try {
    const response = await fetch(`/api/v1/students/${studentId}/approval`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const data: { error?: string } = await response.json().catch(() => ({}));
    return data.error || "עדכון האישור נכשל";
  } catch {
    return "עדכון האישור נכשל";
  }
}

/**
 * אישור או דחייה של כרטיס על ידי מנהל מערכת: בתור הכרטיסים החדשים ובדף הכרטיס.
 * דחייה דורשת סיבה, שנשלחת לבעל הכרטיס. דחייה אפשרית גם לכרטיס מאושר.
 */
export function CardApprovalButtons({ studentId, studentName, status }: Props) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  async function handleApprove() {
    setIsApproving(true);
    const failure = await sendDecision(studentId, { action: "approve" });
    setIsApproving(false);
    if (failure) {
      toast.error(failure);
      return;
    }
    toast.success(`הכרטיס של ${studentName} אושר`);
    router.refresh();
  }

  async function handleReject(reason: string): Promise<string | null> {
    const failure = await sendDecision(studentId, { action: "reject", reason });
    if (failure) return failure;
    toast.success(`הכרטיס של ${studentName} נדחה, והסיבה נשלחה לבעל הכרטיס`);
    router.refresh();
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" && (
        <Button
          type="button"
          size="sm"
          onClick={handleApprove}
          disabled={isApproving}
          aria-label={`אישור הכרטיס של ${studentName}`}
        >
          {isApproving ? "מאשר..." : "אישור"}
        </Button>
      )}
      {status !== "rejected" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIsRejectOpen(true)}
          disabled={isApproving}
          aria-label={`דחיית הכרטיס של ${studentName}`}
        >
          דחייה
        </Button>
      )}
      <ApplicationTextDialog
        open={isRejectOpen}
        onOpenChange={setIsRejectOpen}
        title="דחיית הכרטיס"
        description={`הכרטיס של ${studentName} לא יוצג לשדכנים. הסיבה תישלח לבעל הכרטיס בהתראה ובמייל, והוא יוכל לתקן ולשלוח לאישור מחדש.`}
        fieldLabel="סיבת הדחייה (חובה)"
        submitLabel="דחיית הכרטיס"
        pendingLabel="דוחה..."
        maxLength={REJECTION_REASON_MAX_LENGTH}
        isRequired
        isDestructive
        onSubmit={handleReject}
      />
    </div>
  );
}

/** בקרת האישור בדף הכרטיס - מוצגת למנהל מערכת בלבד */
export function CardApprovalControls(props: Props) {
  return (
    <section
      className="space-y-3 rounded-lg border border-warning bg-warning-muted/40 p-4"
      data-testid="card-approval-controls"
      data-status={props.status}
    >
      <h2 className="text-body-sm font-bold">אישור הנהלה: הצגת הכרטיס</h2>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-48">
          <p className="text-body-sm font-bold">
            {CARD_APPROVAL_LABELS[props.status]}
          </p>
          <p className="text-caption text-muted-foreground">
            {props.status === "approved"
              ? "הכרטיס מוצג לשדכנים."
              : "הכרטיס גלוי לבעליו ולמנהלים בלבד, ואי אפשר לשלוח עליו הצעות."}
          </p>
          {props.status === "rejected" && props.rejectionReason && (
            <p
              className="text-caption text-muted-foreground"
              data-testid="card-rejection-reason-admin"
            >
              סיבת הדחייה: {props.rejectionReason}
            </p>
          )}
        </div>
        <CardApprovalButtons {...props} />
      </div>
    </section>
  );
}
