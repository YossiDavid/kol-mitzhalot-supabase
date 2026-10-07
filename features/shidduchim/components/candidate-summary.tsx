import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { CandidateSummary } from "@/features/shidduchim/lib/candidate-summary";

type CandidateSummaryCardProps = {
  /** "מיועד" או "מיועדת" */
  roleLabel: string;
  /** null כשהכרטיס נמחק: מוצגים רק התווית והשם החלופי */
  studentId: string | null;
  summary: CandidateSummary;
};

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-1">
      <dt className="shrink-0 text-muted-foreground">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * פרטים בסיסיים של מועמד/ת בכרטיס השידוך, כדי שהשדכן לא יצטרך לפתוח את
 * הכרטיס המלא בשביל גיל, מגורים והורים. שורה בלי ערך מושמטת.
 */
export default function CandidateSummaryCard({
  roleLabel,
  studentId,
  summary,
}: CandidateSummaryCardProps) {
  return (
    <div data-testid="candidate-summary" className="space-y-2">
      <div>
        <p className="text-body-sm font-medium text-muted-foreground">
          {roleLabel}
        </p>
        <p className="text-subtitle font-semibold">{summary.fullName}</p>
      </div>
      <dl className="space-y-0.5 text-body-sm">
        <Line label="גיל" value={summary.age} />
        <Line label="מגורים" value={summary.residence} />
        <Line label="קהילה" value={summary.community} />
        <Line label="סטטוס" value={summary.personalStatus} />
        <Line label="הורים" value={summary.parents} />
      </dl>
      {studentId && (
        <Button asChild variant="link" className="h-auto p-0">
          <Link href={`/app/students/${studentId}`}>לכרטיס המלא</Link>
        </Button>
      )}
    </div>
  );
}
