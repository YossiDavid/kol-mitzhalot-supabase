"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CardExclusiveApprovalButton } from "@/features/admin/components/card-exclusive-approval-button";
import {
  CardRejectDialog,
  type CardRejection,
} from "@/features/admin/components/card-reject-dialog";
import {
  CARD_APPROVAL_LABELS,
  NEW_CARDS_PATH,
  type CardApprovalAction,
  type CardApprovalStatus,
} from "@/features/students/lib/card-approval";

type Props = {
  studentId: string;
  studentName: string;
  status: CardApprovalStatus;
  /** סיבת הדחייה הנוכחית, כשהכרטיס נדחה */
  rejectionReason?: string | null;
  /**
   * אחרי אישור או דחייה: מעבר לתור הממתינים (מדף הכרטיס), במקום רענון
   * במקום (בתור עצמו). החזרה להמתנה תמיד נשארת באותו מסך.
   */
  returnToQueue?: boolean;
};

type DirectAction = "approve" | "exclusive" | "reset";

async function sendDecision(
  studentId: string,
  body: CardApprovalAction,
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
 * דחייה דורשת סיבה, שנשלחת לבעל הכרטיס - אלא אם סומן "ללא שליחת הודעה", ואז
 * הסיבה רשות ואין התראה ומייל. דחייה אפשרית גם לכרטיס מאושר. כרטיס שנדחה אפשר
 * להחזיר להמתנה (בלי הודעה לבעליו) או לאשר. "אישור להצעות ממני בלבד" מאשר בלי
 * להציג במאגר; מכרטיס כזה אפשר לאשר אישור מלא או להחזיר להמתנה.
 */
export function CardApprovalButtons({
  studentId,
  studentName,
  status,
  returnToQueue = false,
}: Props) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<DirectAction | null>(
    null,
  );
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  function afterDecision(action: DirectAction | "reject") {
    if (returnToQueue && action !== "reset") {
      router.push(NEW_CARDS_PATH);
      return;
    }
    router.refresh();
  }

  async function runAction(
    action: DirectAction,
    success: string,
  ): Promise<boolean> {
    setPendingAction(action);
    const failure = await sendDecision(studentId, { action });
    setPendingAction(null);
    if (failure) {
      toast.error(failure);
      return false;
    }
    toast.success(success);
    afterDecision(action);
    return true;
  }

  async function handleReject({
    reason,
    silent,
  }: CardRejection): Promise<string | null> {
    const failure = await sendDecision(studentId, {
      action: "reject",
      reason,
      silent,
    });
    if (failure) return failure;
    toast.success(
      silent
        ? `הכרטיס של ${studentName} נדחה, בלי הודעה לבעל הכרטיס`
        : `הכרטיס של ${studentName} נדחה, והסיבה נשלחה לבעל הכרטיס`,
    );
    afterDecision("reject");
    return null;
  }

  const isBusy = pendingAction !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" && (
        <Button
          type="button"
          size="sm"
          onClick={() =>
            void runAction("approve", `הכרטיס של ${studentName} אושר`)
          }
          disabled={isBusy}
          aria-label={`אישור הכרטיס של ${studentName}`}
        >
          {pendingAction === "approve"
            ? "מאשר..."
            : status === "exclusive"
              ? "אישור מלא (הצגה במאגר)"
              : "אישור"}
        </Button>
      )}
      {status !== "exclusive" && (
        <CardExclusiveApprovalButton
          studentName={studentName}
          isDisabled={isBusy}
          onConfirm={() =>
            runAction(
              "exclusive",
              `הכרטיס של ${studentName} אושר להצעות ממך בלבד`,
            )
          }
        />
      )}
      {(status === "rejected" || status === "exclusive") && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void runAction(
              "reset",
              `הכרטיס של ${studentName} הוחזר להמתנה לאישור`,
            )
          }
          disabled={isBusy}
          aria-label={`החזרה להמתנה של הכרטיס של ${studentName}`}
        >
          {pendingAction === "reset" ? "מחזיר..." : "החזרה להמתנה"}
        </Button>
      )}
      {status !== "rejected" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIsRejectOpen(true)}
          disabled={isBusy}
          aria-label={`דחיית הכרטיס של ${studentName}`}
        >
          דחייה
        </Button>
      )}
      <CardRejectDialog
        open={isRejectOpen}
        onOpenChange={setIsRejectOpen}
        studentName={studentName}
        onSubmit={handleReject}
      />
    </div>
  );
}

const STATUS_EXPLANATIONS: Record<CardApprovalStatus, string> = {
  approved: "הכרטיס מוצג לשדכנים.",
  exclusive:
    "הכרטיס אינו מוצג במאגר. רק מנהל מערכת רואה אותו ושולח עליו הצעות.",
  pending:
    "הכרטיס גלוי לבעליו ולמנהלים בלבד, ואי אפשר לשלוח עליו הצעות.",
  rejected:
    "הכרטיס גלוי לבעליו ולמנהלים בלבד, ואי אפשר לשלוח עליו הצעות.",
};

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
            {STATUS_EXPLANATIONS[props.status]}
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
