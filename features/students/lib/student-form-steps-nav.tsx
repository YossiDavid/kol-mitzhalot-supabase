"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type StepState = "active" | "completed" | "upcoming";

export type StudentFormStepsNavProps = {
  titles: readonly string[];
  currentStepIndex: number;
  /** שלבים שעברו ולידציה בהצלחה */
  completedSteps: ReadonlySet<number>;
  /** בהקדמה, לפני שנבחר מגדר, אי אפשר לקפוץ קדימה */
  isForwardDisabled: boolean;
  onStepClick: (index: number) => void;
};

const MARKER_STATE_CLASS: Record<StepState, string> = {
  active: "border-primary bg-primary text-primary-foreground",
  completed: "border-primary bg-primary-muted text-primary",
  upcoming: "border-border bg-card text-muted-foreground",
};

/**
 * ניווט השלבים של אשף הקו״ח. מ-lg: רשימה אנכית צרה עם מספרים. מתחת ל-lg: פס
 * שלבים ממוספר שכולו נכנס ברוחב המסך (הכותרת "שלב X מתוך N" מעל כותרת השלב).
 *
 * שם הכפתור הנגיש הוא כותרת השלב בלבד - הבדיקות והצילומים מאתרים את השלבים
 * לפי השם הזה. בכל רוחב רק אחת מהרשימות מוצגת, והשנייה מוסתרת גם מעץ הנגישות.
 */
export function StudentFormStepsNav({
  titles,
  currentStepIndex,
  completedSteps,
  isForwardDisabled,
  onStepClick,
}: StudentFormStepsNavProps) {
  const getState = (index: number): StepState => {
    if (index === currentStepIndex) return "active";
    return completedSteps.has(index) ? "completed" : "upcoming";
  };
  const isDisabled = (index: number) =>
    isForwardDisabled && index > currentStepIndex;

  return (
    <nav aria-label="שלבי הטופס" className="lg:sticky lg:top-20 lg:self-start">
      <ol className="flex items-center lg:hidden">
        {titles.map((title, index) => (
          <li
            key={index}
            className={cn("flex items-center", index > 0 && "flex-1")}
          >
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-1 h-0.5 flex-1 rounded-full",
                  index <= currentStepIndex ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <button
              type="button"
              aria-label={title}
              aria-current={index === currentStepIndex ? "step" : undefined}
              disabled={isDisabled(index)}
              onClick={() => onStepClick(index)}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border text-caption font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                MARKER_STATE_CLASS[getState(index)],
              )}
            >
              <StepMarker index={index} state={getState(index)} />
            </button>
          </li>
        ))}
      </ol>

      <ol className="hidden space-y-1 lg:block">
        {titles.map((title, index) => {
          const state = getState(index);
          return (
            <li key={index}>
              <button
                type="button"
                aria-current={state === "active" ? "step" : undefined}
                disabled={isDisabled(index)}
                onClick={() => onStepClick(index)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start text-body-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  state === "active"
                    ? "bg-primary-muted font-bold text-primary"
                    : "hover:bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-bold",
                    MARKER_STATE_CLASS[state],
                  )}
                >
                  <StepMarker index={index} state={state} />
                </span>
                <span>{title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepMarker({ index, state }: { index: number; state: StepState }) {
  if (state === "completed") {
    return <Check aria-hidden className="size-4" strokeWidth={3} />;
  }
  return <span aria-hidden>{index + 1}</span>;
}
