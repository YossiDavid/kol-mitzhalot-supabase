"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CardAdminPauseDialog } from "@/features/admin/components/card-admin-pause-dialog";

/**
 * פעולות על דיווח בודד: "סומן כטופל" (דיווח פתוח בלבד) והשהיית הכרטיס
 * המדווח / ביטול ההשהיה (עם דיאלוג אישור).
 */
export function CardReportActions({
  reportId,
  studentId,
  studentName,
  isOpen,
  isPaused,
}: {
  reportId: string;
  studentId: string;
  studentName: string;
  isOpen: boolean;
  isPaused: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [isPauseOpen, setIsPauseOpen] = useState(false);

  const markHandled = async () => {
    setIsPending(true);
    try {
      const res = await fetch(`/api/v1/admin/card-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "handled" }),
      });
      if (!res.ok) {
        toast.error("עדכון הדיווח נכשל");
        return;
      }
      toast.success("הדיווח סומן כטופל");
      router.refresh();
    } catch {
      toast.error("עדכון הדיווח נכשל");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isOpen && (
        <Button
          type="button"
          size="sm"
          onClick={markHandled}
          disabled={isPending}
          data-testid={`card-report-handle-${reportId}`}
        >
          סומן כטופל
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsPauseOpen(true)}
        data-testid={`card-report-pause-${reportId}`}
      >
        {isPaused ? "ביטול השהיה" : "השהיית הכרטיס"}
      </Button>
      <CardAdminPauseDialog
        studentId={studentId}
        studentName={studentName}
        isPaused={isPaused}
        open={isPauseOpen}
        onOpenChange={setIsPauseOpen}
      />
    </div>
  );
}
