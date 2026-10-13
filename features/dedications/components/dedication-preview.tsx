"use client";

import { DedicationTile } from "@/components/website/dedications/dedication-tile";
import type { DedicationFormValues } from "@/features/dedications/lib/dedication-schema";

/** טקסט דמה כשהשדה עוד ריק, כדי שהקובייה בתצוגה לא תיראה שבורה */
const PLACEHOLDER_HONOREE = "שם המוקדש";

/**
 * תצוגה מקדימה חיה: אותו רכיב של האתר (DedicationTile) עם ערכי הטופס
 * הנוכחיים. סוג הפרנס קובע את הגודל, כמו באתר.
 */
export function DedicationPreview({
  values,
}: {
  values: DedicationFormValues;
}) {
  return (
    <div
      aria-label="תצוגה מקדימה"
      data-testid="dedication-preview"
      className="rounded-xl bg-background p-4"
    >
      <p className="mb-3 text-caption font-bold text-muted-foreground">
        כך זה ייראה באתר
      </p>
      <DedicationTile
        kind={values.kind}
        dedicationType={values.dedication_type || null}
        honoree={values.honoree.trim() || PLACEHOLDER_HONOREE}
        donorLine={values.donor_line.trim() || null}
        note={values.note.trim() || null}
        startsOn={values.starts_on}
        endsOn={values.ends_on || null}
      />
    </div>
  );
}
