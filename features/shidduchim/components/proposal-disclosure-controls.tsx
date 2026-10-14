"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DISCLOSURE_ITEMS,
  type DisclosureKey,
  type ProposalDisclosureFlags,
} from "@/features/shidduchim/lib/proposal-disclosure";

type PendingChange = { key: DisclosureKey; label: string; open: boolean };

/**
 * "מה הצדדים רואים": השדכן של ההצעה (או מנהל) פותח או סוגר פריטים בכרטיס של
 * הצד השני. כל שינוי מאושר בחלון. פתיחה בהצעה שנשלחה מודיעה לצד שקיבל אותה
 * (פעמון ומייל); סגירה - בשקט. פרטי התקשרות של המיועד/ת ושל ההורים אינם כאן.
 */
export function ProposalDisclosureControls({
  shidduchId,
  flags,
  isSent,
}: {
  shidduchId: string;
  flags: ProposalDisclosureFlags;
  isSent: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingChange | null>(null);

  async function applyChange(): Promise<boolean> {
    if (!pending) return false;
    const response = await fetch(`/api/v1/shidduchim/${shidduchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...flags, [pending.key]: pending.open }),
    });
    const data: { error?: string; notified?: number } = await response
      .json()
      .catch(() => ({}));
    if (!response.ok) {
      toast.error(data.error || "השמירה נכשלה");
      return false;
    }
    toast.success(
      pending.open
        ? data.notified
          ? `נפתח: ${pending.label}. הצד שקיבל את ההצעה קיבל עדכון`
          : `נפתח: ${pending.label}`
        : `נסגר: ${pending.label}`,
    );
    return true;
  }

  return (
    <section
      className="space-y-3 rounded-lg border border-border bg-card p-4"
      data-testid="proposal-disclosure-controls"
    >
      <div className="space-y-1">
        <h2 className="text-body font-bold">מה הצדדים רואים</h2>
        <p className="text-caption text-muted-foreground">
          מה מנהלי הכרטיסים רואים בכרטיס של הצד השני. פרטי ההתקשרות של המיועד/ת
          ושל ההורים אינם נחשפים בשום מצב.
          {isSent
            ? " פריט שנפתח עכשיו - הצד שקיבל את ההצעה יקבל על כך עדכון."
            : ""}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {DISCLOSURE_ITEMS.map((item) => (
          <div key={item.key} className="flex items-start gap-2">
            <Checkbox
              id={`disclosure-${item.key}`}
              checked={flags[item.key]}
              onCheckedChange={(checked) =>
                setPending({
                  key: item.key,
                  label: item.label,
                  open: checked === true,
                })
              }
              aria-describedby={`disclosure-${item.key}-hint`}
            />
            <div className="space-y-0.5">
              <Label
                htmlFor={`disclosure-${item.key}`}
                className="text-body-sm leading-snug font-normal"
              >
                {item.label}
              </Label>
              <p
                id={`disclosure-${item.key}-hint`}
                className="text-caption text-muted-foreground"
              >
                {item.hint}
              </p>
            </div>
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title={pending?.open ? "לפתוח לצדדים?" : "לסגור לצדדים?"}
        description={
          pending?.open
            ? `${pending.label} יוצג למנהלי הכרטיסים בכרטיס של הצד השני.${
                isSent
                  ? " הצד שקיבל את ההצעה יקבל על כך עדכון בהתראה ובמייל."
                  : ""
              }`
            : `${pending?.label ?? ""} לא יוצג עוד בכרטיס של הצד השני.`
        }
        confirmLabel={pending?.open ? "פתיחה" : "סגירה"}
        pendingLabel="שומר..."
        isDestructive={false}
        onConfirm={applyChange}
        onSuccess={() => {
          setPending(null);
          router.refresh();
        }}
        onError={(error) => {
          console.error(error);
          toast.error("השמירה נכשלה");
        }}
      />
    </section>
  );
}
