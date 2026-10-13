"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  CARD_APPROVAL_LABELS,
  CARD_PENDING_EXPLANATION,
  CARD_REJECTED_EXPLANATION,
} from "@/features/students/lib/card-approval";

/**
 * מצב האישור כפי שבעל הכרטיס רואה אותו בדף הכרטיס: ממתין, או נדחה עם הסיבה
 * וכפתור "שליחה לאישור מחדש". כרטיס מאושר אינו מציג דבר.
 *
 * השליחה מחדש היא פעולה מפורשת ולא תוצאה של שמירה: הטופס נשמר שלב אחר שלב,
 * ושמירה של השלב הראשון הייתה שולחת למנהל כרטיס שתיקונו עוד לא הסתיים.
 */
export function CardApprovalBanner({
  studentId,
  status,
  rejectionReason,
}: {
  studentId: string;
  status: "pending" | "rejected";
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);

  async function handleResubmit() {
    setIsSending(true);
    try {
      const response = await fetch(`/api/v1/students/${studentId}/approval`, {
        method: "POST",
      });
      if (!response.ok) {
        const data: { error?: string } = await response
          .json()
          .catch(() => ({}));
        toast.error(data.error || "השליחה לאישור נכשלה");
        return;
      }
      toast.success("הכרטיס נשלח לאישור הנהלת המערכת");
      router.refresh();
    } catch {
      toast.error("השליחה לאישור נכשלה");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section
      className="space-y-2 rounded-lg border border-warning bg-warning-muted/40 p-4"
      data-testid="card-approval-banner"
      data-status={status}
      role="status"
    >
      <h2 className="text-body-sm font-bold">{CARD_APPROVAL_LABELS[status]}</h2>
      <p className="text-body-sm text-muted-foreground">
        {status === "pending"
          ? CARD_PENDING_EXPLANATION
          : CARD_REJECTED_EXPLANATION}
      </p>
      {status === "rejected" && (
        <>
          {rejectionReason && (
            <p className="text-body-sm" data-testid="card-rejection-reason">
              <span className="font-bold">הערת ההנהלה: </span>
              {rejectionReason}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleResubmit}
            disabled={isSending}
          >
            {isSending ? "שולח..." : "שליחה לאישור מחדש"}
          </Button>
        </>
      )}
    </section>
  );
}
