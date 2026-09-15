"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// פס הפעולות הדביק שבתחתית אשף הקו״ח: חזרה, המשך, שליחה בשלב האחרון -
// ובעריכה גם "שמירת שינויים" מכל שלב.

// מתחת ל-md הניווט התחתון של האפליקציה קבוע בתחתית המסך
// (components/layout/bottom-nav.tsx, h-16 + safe area), ולכן הפס יושב מעליו.
// הפס דביק ולא fixed: בסוף השלב הוא חוזר למקומו ולא מסתיר את השדה האחרון.
const STICKY_ACTIONS_CLASS =
  "sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-2 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 md:bottom-0 md:mx-0 md:px-0 md:py-4";

const SAVE_LABEL = "שמירת שינויים";
const SAVE_LABEL_SHORT = "שמירה";
const UNSAVED_CHANGES_LABEL = "יש שינויים שלא נשמרו";

type ButtonClick = MouseEvent<HTMLButtonElement>;

export type SaveProgressAction = {
  /** יש שינויים מאז השמירה האחרונה */
  isDirty: boolean;
  /** שמירה או טעינת הנתונים השמורים מחדש בעיצומן */
  isSaving: boolean;
  savingLabel: string;
  onSave: (event: ButtonClick) => void;
};

type StudentFormActionsBarProps = {
  isFirstStep: boolean;
  isLastStep: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onPrevious: (event: ButtonClick) => void;
  onNext: (event: ButtonClick) => void;
  /** עריכה בלבד. ביצירה נשאר undefined והפס זהה לקודם */
  saveProgress?: SaveProgressAction;
};

// Enter על "המשך" לא מפעיל אותו: בשלב הלפני אחרון הלחיצה הייתה נוחתת על
// כפתור השליחה שמופיע באותו מקום
function preventEnterActivation(event: KeyboardEvent<HTMLButtonElement>) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
}

export function StudentFormActionsBar({
  isFirstStep,
  isLastStep,
  isSubmitting,
  submitLabel,
  submittingLabel,
  onPrevious,
  onNext,
  saveProgress,
}: StudentFormActionsBarProps) {
  // במובייל אין רוחב לשלושה כפתורים מלאים: "חזרה" מצטמצם לאייקון
  // (השם הנגיש נשאר) ו"שמירת שינויים" ל"שמירה"
  const isCompact = Boolean(saveProgress) && !isLastStep;
  const isDirty = saveProgress?.isDirty ?? false;
  const isBusy = isSubmitting || (saveProgress?.isSaving ?? false);

  return (
    <div className={STICKY_ACTIONS_CLASS}>
      <Button
        variant="outline"
        type="button"
        onClick={onPrevious}
        disabled={isFirstStep}
        className={cn(isCompact && "max-sm:px-3")}
      >
        <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
        <span className={cn(isCompact && "max-sm:sr-only")}>חזרה</span>
      </Button>

      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        {saveProgress && isDirty && !isBusy && <UnsavedChangesNotice />}

        {saveProgress && !isLastStep && (
          <SaveProgressButton {...saveProgress} isDisabled={isBusy || !isDirty} />
        )}

        {isLastStep ? (
          <Button type="submit" disabled={isBusy}>
            <span>{isBusy ? submittingLabel : submitLabel}</span>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            onKeyDown={preventEnterActivation}
          >
            <span>המשך לשלב הבא</span>
            <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
          </Button>
        )}
      </div>
    </div>
  );
}

function UnsavedChangesNotice() {
  return (
    <p className="hidden items-center gap-2 text-caption text-muted-foreground md:flex">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
      {UNSAVED_CHANGES_LABEL}
    </p>
  );
}

type SaveProgressButtonProps = SaveProgressAction & { isDisabled: boolean };

function SaveProgressButton({
  isDirty,
  isSaving,
  savingLabel,
  onSave,
  isDisabled,
}: SaveProgressButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onSave}
      disabled={isDisabled}
      aria-label={isSaving ? savingLabel : SAVE_LABEL}
      title={isDirty && !isSaving ? UNSAVED_CHANGES_LABEL : undefined}
      className="relative max-sm:px-3"
    >
      <Save aria-hidden className="size-4" />
      <span className="max-sm:hidden">{isSaving ? savingLabel : SAVE_LABEL}</span>
      <span className="sm:hidden">{isSaving ? savingLabel : SAVE_LABEL_SHORT}</span>
      {/* במובייל אין מקום לטקסט "יש שינויים שלא נשמרו" - נקודה על הכפתור */}
      {isDirty && !isSaving && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 size-2.5 rounded-full bg-warning ring-2 ring-card md:hidden"
        />
      )}
    </Button>
  );
}
