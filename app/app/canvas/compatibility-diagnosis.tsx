"use client";

import { AlertTriangleIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  issues: string[];
  /** כשמוגדר, מוצג כפתור סגירה (למשל אחרי רענון) */
  onDismiss?: () => void;
};

export default function CompatibilityDiagnosis({ issues, onDismiss }: Props) {
  const hasIssues = issues.length > 0;

  return (
    <div className="flex w-full justify-center px-4">
      <div
        className={
          hasIssues
            ? "relative w-full max-w-lg rounded-md border border-amber-200 border-e-4 border-e-amber-400 bg-amber-50 p-4 pe-5 ps-10 text-amber-950 shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            : "relative w-full max-w-lg rounded-md border border-emerald-200 border-e-4 border-e-emerald-400 bg-emerald-50/80 p-4 pe-5 ps-10 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
        }
      >
        {onDismiss && (
          <Button
            type="button"
            onClick={onDismiss}
            variant="ghost"
            size="icon"
            className="absolute start-1 top-1 h-8 w-8 hover:bg-transparent"
            aria-label="סגור"
          >
            <X className="size-4" />
          </Button>
        )}

        <div className="flex gap-2">
          {hasIssues ? (
            <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-base font-bold">
              {hasIssues ? "שים לב:" : "אבחון התאמה"}
            </h3>
            {hasIssues ? (
              <ol className="list-decimal space-y-1 ps-5 text-sm leading-relaxed">
                {issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm leading-relaxed">
                לא זוהו הערות מהותיות באבחון זה. ניתן להמשיך לשמירה או שליחה.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
