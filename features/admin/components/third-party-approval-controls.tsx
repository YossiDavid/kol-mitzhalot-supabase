"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type ApprovalKind = "full_display" | "proposals";

export type ApprovalState = {
  /** מתי אושר; null = לא אושר */
  approvedAt: string | null;
  /** שם המנהל שאישר, כשידוע (null באישור שניתן אוטומטית בהטמעה) */
  approvedByName: string | null;
};

const KIND_LABELS: Record<ApprovalKind, string> = {
  full_display: "הצגת נתונים מלאים",
  proposals: "אפשרות לשלוח הצעות",
};

function formatApprovedAt(approvedAt: string): string {
  return new Date(approvedAt).toLocaleDateString("he-IL");
}

export function ThirdPartyApprovalToggle({
  studentId,
  kind,
  state,
}: {
  studentId: string;
  kind: ApprovalKind;
  state: ApprovalState;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isApproved = state.approvedAt !== null;
  const label = KIND_LABELS[kind];

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/v1/students/${studentId}/third-party-approval`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, approved: !isApproved }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || "עדכון האישור נכשל");
        return;
      }
      toast.success(isApproved ? `האישור בוטל: ${label}` : `אושר: ${label}`);
      router.refresh();
    } catch {
      toast.error("עדכון האישור נכשל");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid={`approval-${kind}`}
      data-approved={isApproved}
    >
      <div className="min-w-48">
        <p className="text-body-sm font-bold">{label}</p>
        <p className="text-caption text-muted-foreground">
          {isApproved
            ? `אושר ב-${formatApprovedAt(state.approvedAt as string)}${
                state.approvedByName ? ` על ידי ${state.approvedByName}` : ""
              }`
            : "טרם אושר"}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant={isApproved ? "outline" : "default"}
        onClick={handleClick}
        disabled={isLoading}
        aria-label={`${isApproved ? "ביטול אישור" : "אישור"}: ${label}`}
      >
        {isApproved ? "ביטול אישור" : "אישור"}
      </Button>
    </div>
  );
}

/** בקרות האישור של כרטיס צד שלישי - מוצגות למנהל מערכת בלבד */
export function ThirdPartyApprovalControls({
  studentId,
  fullDisplay,
  proposals,
}: {
  studentId: string;
  fullDisplay: ApprovalState;
  proposals: ApprovalState;
}) {
  return (
    <section
      className="space-y-3 rounded-lg border border-warning bg-warning-muted/40 p-4"
      data-testid="third-party-approval-controls"
    >
      <h2 className="text-body-sm font-bold">אישור הנהלה: כרטיס צד שלישי</h2>
      <div className="flex flex-wrap gap-x-10 gap-y-3">
        <ThirdPartyApprovalToggle
          studentId={studentId}
          kind="full_display"
          state={fullDisplay}
        />
        <ThirdPartyApprovalToggle
          studentId={studentId}
          kind="proposals"
          state={proposals}
        />
      </div>
    </section>
  );
}
