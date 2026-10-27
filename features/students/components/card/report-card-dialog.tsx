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
  isCardReportDetailsRequired,
  type CardReportReason,
} from "@/features/students/lib/card-report";

const GENERIC_ERROR = "שליחת הדיווח נכשלה";

/**
 * דיאלוג "דיווח על הכרטיס", נשלט מבחוץ (נפתח מפריט בתפריט הפעולות). הסיבה
 * חובה; ב"אחר" וב"דיווח מורחב להנהלה" גם הפירוט חובה. הצופה מזוהה בשרת
 * מהסשן, לא מהגוף. initialReason - פריט "דיווח מורחב להנהלה" פותח את הדיאלוג
 * עם הסיבה כבר בחורה.
 */
export function ReportCardDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
  initialReason = "",
}: {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialReason?: CardReportReason | "";
}) {
  const [reason, setReason] = useState<CardReportReason | "">(initialReason);
  // הדיאלוג נשאר מורכב בין פתיחות: בכל פתיחה מתחילים מהסיבה שהפריט ביקש
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setReason(initialReason);
  }
  const isDetailsRequired = reason !== "" && isCardReportDetailsRequired(reason);
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
    if (isDetailsRequired && !details.trim()) {
      setFormError("יש לפרט את הדיווח");
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
            <Label htmlFor="report-details" required={isDetailsRequired}>
              פירוט
            </Label>
            <Textarea
              id="report-details"
              value={details}
              maxLength={CARD_REPORT_DETAILS_MAX_LENGTH}
              onChange={(event) => setDetails(event.target.value)}
              placeholder={isDetailsRequired ? "פרטו את הדיווח" : "אופציונלי"}
              className={reason === "admin_update" ? "min-h-48" : undefined}
            />
            <p className="text-caption text-muted-foreground">
              עד {CARD_REPORT_DETAILS_MAX_LENGTH.toLocaleString("he-IL")} תווים.
              הדיווח גלוי להנהלה בלבד.
            </p>
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
