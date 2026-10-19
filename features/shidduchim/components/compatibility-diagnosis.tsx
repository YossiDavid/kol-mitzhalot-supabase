"use client";

import { AlertTriangleIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

type Props = {
  issues: string[];
  /** התאמה שאסור להציע (למשל כהן וגרושה): מוצגת כאזהרה חמורה ואינה נסגרת */
  blockers?: string[];
  /** כשמוגדר, מוצג כפתור סגירה (למשל אחרי רענון) */
  onDismiss?: () => void;
};

function BlockersAlert({ blockers }: { blockers: string[] }) {
  return (
    <div className="flex w-full justify-center px-4">
      <div
        role="alert"
        data-testid="compatibility-blockers"
        className="flex w-full max-w-lg gap-2 rounded-md border border-destructive bg-destructive/10 p-4 text-destructive"
      >
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-body font-bold">לא ניתן להציע את הצמד הזה</h3>
          <ul className="list-disc space-y-1 ps-5 text-body-sm leading-relaxed">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CompatibilityDiagnosis({
  issues,
  blockers = [],
  onDismiss,
}: Props) {
  if (blockers.length > 0) return <BlockersAlert blockers={blockers} />;

  const hasIssues = issues.length > 0;

  return (
    <div className="flex w-full justify-center px-4">
      <div
        className={
          hasIssues
            ? "relative w-full max-w-lg rounded-md border border-warning bg-warning-muted p-4 text-warning-muted-foreground shadow-sm"
            : "relative w-full max-w-lg rounded-md border border-success bg-success-muted p-4 text-success-muted-foreground"
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

        {/* כפתור הסגירה ממוקם absolute בקצה ה-start, שהוא בדיוק מאיפה
            שהכותרת מתחילה ב-RTL. מפנים לו מקום כדי שלא יעלה עליה. */}
        <div className={cn("flex gap-2", onDismiss && "ps-9")}>
          {hasIssues ? (
            <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-warning-muted-foreground" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-body font-bold">
              {hasIssues ? "שים לב:" : "אבחון התאמה"}
            </h3>
            {hasIssues ? (
              <ol className="list-decimal space-y-1 ps-5 text-body-sm leading-relaxed">
                {issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ol>
            ) : (
              <p className="text-body-sm leading-relaxed">
                לא זוהו הערות מהותיות באבחון זה. ניתן להמשיך לשמירה או שליחה.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
