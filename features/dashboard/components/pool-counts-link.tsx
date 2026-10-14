import Link from "next/link";
import { Users } from "lucide-react";

import type { PoolCounts } from "@/features/dashboard/lib/queries";

/** מספר שלא נטען מוצג כמקף, ולא כ-0 שגוי */
function figure(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("he-IL");
}

/**
 * גודל המאגר ב"כלי שדכן": כל הכרטיסים הגלויים ו"חדשים השבוע". הקישור מוביל
 * לרשימת המיועדים. לשדכנים ולמנהלים בלבד (ההורים לא רואים ספירות מאגר).
 */
export function PoolCountsLink({ counts }: { counts: PoolCounts }) {
  return (
    <Link
      href="/app/students"
      data-testid="dashboard-pool-counts"
      className="-mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-body-sm transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Users className="size-5 shrink-0 text-primary" aria-hidden />
      <span>
        כרטיסים במאגר:{" "}
        <strong data-testid="dashboard-pool-total" className="tabular-nums">
          {figure(counts.total)}
        </strong>
      </span>
      <span className="text-muted-foreground">
        חדשים השבוע:{" "}
        <strong
          data-testid="dashboard-pool-new"
          className="text-foreground tabular-nums"
        >
          {figure(counts.newThisWeek)}
        </strong>
      </span>
    </Link>
  );
}
