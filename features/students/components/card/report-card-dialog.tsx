"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  CARD_REPORT_DETAILS_MAX_LENGTH,
  CARD_REPORT_REASONS,
  CARD_REPORT_REASON_LABELS,
  type CardReportReason,
} from "@/features/students/lib/card-report";

const GENERIC_ERROR = "שליחת הדיווח נכשלה";

/**
 * דיאלוג "דיווח על הכרטיס", נשלט מבחוץ (נפתח מפריט בתפריט הפעולות). הסיבה
 * חובה; בסיבה "אחר" גם הפירוט חובה. הצופה מזוהה בשרת מהסשן, לא מהגוף.
 */
export function ReportCardDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
}: {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState<CardReportReason | "">("");
  const [details, setDetails] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (isPending) return;
    if (!next) {
      setReason("");
      setDetails("");
      setFormError(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!reason) {
      setFormError("יש לבחור סיבת דיווח");
      return;
    }
    if (reason === "other" && !details.trim()) {
      setFormError('בסיבה "אחר" יש לפרט את הדיווח');
      return;
    }
    setFormError(null);
    setIsPending(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? GENERIC_ERROR);
        return;
      }
      toast.success("הדיווח נשלח למנהל. תודה");
      handleOpenChange(false);
    } catch {
      setFormError(GENERIC_ERROR);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="sm" data-testid="report-card-dialog">
        <DialogHeader>
          <DialogTitle>דיווח על הכרטיס</DialogTitle>
          <DialogDescription>
            הדיווח על הכרטיס של {studentName} יישלח למנהל המערכת.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason" required>
              סיבת הדיווח
            </Label>
            <NativeSelect
              id="report-reason"
              value={reason}
              onChange={(event) =>
                setReason(event.target.value as CardReportReason | "")
              }
              aria-invalid={formError !== null && !reason}
            >
              <NativeSelectOption value="">בחרו סיבה</NativeSelectOption>
              {CARD_REPORT_REASONS.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {CARD_REPORT_REASON_LABELS[value]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details" required={reason === "other"}>
              פירוט
            </Label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={CARD_REPORT_DETAILS_MAX_LENGTH}
              onChange={(event) => setDetails(event.target.value)}
              placeholder={reason === "other" ? "פרטו את הדיווח" : "אופציונלי"}
            />
          </div>

          {formError && (
            <p
              role="alert"
              className="text-body-sm text-destructive"
              data-testid="report-card-error"
            >
              {formError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            ביטול
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "שולח..." : "שליחת דיווח"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
