"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hourglass } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ApplicationTextDialog } from "@/features/admin/components/application-text-dialog";
import {
  MATCHMAKING_HOLD_REASON_MAX_LENGTH,
  type MatchmakingHold,
} from "@/features/students/lib/card-matchmaking-hold";

const SET_FAILED = "עדכון המצב נכשל, נסו שוב";

/**
 * "בתהליך שידוך": הודעה לשדכנים (עם הסיבה) שהכרטיס זמנית אינו מקבל הצעות,
 * ולמנהל הכרטיס ולמנהל המערכת - סימון והסרה. ההרשאה נאכפת ב-RPC.
 */
export function MatchmakingHoldPanel({
  studentId,
  hold,
  canManage,
}: {
  studentId: string;
  hold: MatchmakingHold | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  async function setHold(isOn: boolean, reason?: string): Promise<string | null> {
    const { error } = await createClient().rpc("set_card_matchmaking_hold", {
      p_student_id: studentId,
      p_on: isOn,
      p_reason: reason ?? null,
    });
    if (error) {
      console.error("[matchmaking-hold] set failed", error.message);
      return error.message.includes("hold_set_by_admin")
        ? "את הסימון הציבה הנהלת המערכת, ורק היא יכולה להסיר אותו"
        : SET_FAILED;
    }
    toast.success(isOn ? "הכרטיס סומן בתהליך שידוך" : "הכרטיס חזר לקבל הצעות");
    router.refresh();
    return null;
  }

  async function release() {
    setIsBusy(true);
    const failure = await setHold(false);
    setIsBusy(false);
    if (failure) toast.error(failure);
  }

  if (!hold && !canManage) return null;

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-info bg-info-muted px-4 py-3 text-body-sm sm:flex-row sm:items-center sm:justify-between"
      data-testid="card-matchmaking-hold"
    >
      <div className="flex items-start gap-2">
        <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
        {hold ? (
          <p>
            <strong>בתהליך שידוך</strong> - הכרטיס זמנית אינו מקבל הצעות חדשות.
            {hold.reason && (
              <>
                {" "}
                <span className="whitespace-pre-line">{hold.reason}</span>
              </>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground">
            באמצע תהליך? אפשר לסמן את הכרטיס "בתהליך שידוך", והוא לא יקבל הצעות
            חדשות עד להסרת הסימון.
          </p>
        )}
      </div>
      {canManage &&
        (hold ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={() => void release()}
          >
            הסרת הסימון
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
          >
            סימון "בתהליך שידוך"
          </Button>
        ))}
      {isDialogOpen && (
        <ApplicationTextDialog
          open
          onOpenChange={setIsDialogOpen}
          title='סימון "בתהליך שידוך"'
          description="הכרטיס יישאר גלוי לשדכנים, אבל לא יהיה אפשר לשלוח אליו הצעות חדשות עד להסרת הסימון. הסיבה תוצג לשדכנים."
          fieldLabel="סיבה לשדכנים (לא חובה), למשל: נפגשים כעת, נעדכן בהקדם"
          submitLabel="סימון"
          pendingLabel="מסמן..."
          maxLength={MATCHMAKING_HOLD_REASON_MAX_LENGTH}
          isRequired={false}
          onSubmit={(text) => setHold(true, text)}
        />
      )}
    </div>
  );
}
