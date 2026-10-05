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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  PROPOSAL_LIMIT_MAX,
  PROPOSAL_LIMIT_MIN,
  PROPOSAL_LIMIT_PERIODS,
  PROPOSAL_LIMIT_PERIOD_LABELS,
  describeProposalLimit,
  type ProposalLimit,
  type ProposalLimitPeriod,
} from "@/features/students/lib/proposal-limit";

const DEFAULT_COUNT = 3;
const DEFAULT_PERIOD: ProposalLimitPeriod = "week";

type Props = {
  studentId: string;
  studentName: string;
  limit: ProposalLimit;
  onChanged: (limit: ProposalLimit) => void;
};

/**
 * "הגבלת הצעות": מנהל הכרטיס קובע כמה הצעות הכרטיס מוכן לקבל ביום / בשבוע /
 * בחודש. השמירה עוברת ב-route ייעודי; האכיפה על השדכנים נעשית בשרת ובמסד.
 */
export function ProposalLimitControl({
  studentId,
  studentName,
  limit,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countText, setCountText] = useState(String(DEFAULT_COUNT));
  const [period, setPeriod] = useState<ProposalLimitPeriod>(DEFAULT_PERIOD);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setCountText(String(limit.count ?? DEFAULT_COUNT));
      setPeriod(limit.period ?? DEFAULT_PERIOD);
    }
    setOpen(nextOpen);
  };

  const save = async (next: ProposalLimit) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/students/${studentId}/proposal-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "שמירת ההגבלה נכשלה");
        return;
      }
      onChanged(next);
      toast.success(next.count === null ? "ההגבלה בוטלה" : "ההגבלה נשמרה");
      setOpen(false);
    } catch {
      toast.error("שמירת ההגבלה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const count = Number(countText);
  const isCountValid =
    Number.isInteger(count) &&
    count >= PROPOSAL_LIMIT_MIN &&
    count <= PROPOSAL_LIMIT_MAX;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
        aria-label={`הגבלת הצעות: ${studentName}`}
      >
        {limit.count === null ? "הגבלת הצעות" : describeProposalLimit(limit)}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הגבלת הצעות</DialogTitle>
            <DialogDescription>
              כמה הצעות {studentName} מוכן/ה לקבל. כשהמכסה מתמלאת שדכנים לא
              יוכלו לשלוח הצעה חדשה עד שהיא תתפנה.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-2">
              <Label htmlFor={`limit-count-${studentId}`}>מספר הצעות</Label>
              <Input
                id={`limit-count-${studentId}`}
                type="number"
                inputMode="numeric"
                min={PROPOSAL_LIMIT_MIN}
                max={PROPOSAL_LIMIT_MAX}
                value={countText}
                onChange={(event) => setCountText(event.target.value)}
                disabled={saving}
                aria-invalid={!isCountValid}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`limit-period-${studentId}`}>בכל</Label>
              <NativeSelect
                id={`limit-period-${studentId}`}
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value as ProposalLimitPeriod)
                }
                disabled={saving}
              >
                {PROPOSAL_LIMIT_PERIODS.map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {PROPOSAL_LIMIT_PERIOD_LABELS[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          {!isCountValid && (
            <p className="text-caption text-destructive" role="alert">
              יש להזין מספר שלם בין {PROPOSAL_LIMIT_MIN} ל-
              {PROPOSAL_LIMIT_MAX}
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              type="button"
              onClick={() => save({ count, period })}
              disabled={saving || !isCountValid}
            >
              {saving ? "שומר…" : "שמירה"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => save({ count: null, period: null })}
              disabled={saving || limit.count === null}
            >
              ללא הגבלה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
