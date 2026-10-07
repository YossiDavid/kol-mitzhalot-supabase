import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

import { GLANCE_STATS, loadAllCounts } from "../../lib/dashboard-stats";
import { DashboardCount } from "./dashboard-count";

/** "במבט חטוף": סכומים זולים (ספירות בלבד) */
export async function DashboardGlance() {
  noStore();
  const entries = await loadAllCounts(GLANCE_STATS);
  const countByKey = new Map(entries.map(({ key, count }) => [key, count]));

  return (
    <section aria-labelledby="admin-glance-title" className="space-y-3">
      <h2 id="admin-glance-title" className="text-subtitle font-bold">
        במבט חטוף
      </h2>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {GLANCE_STATS.map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            data-testid={`glance-${key}`}
            className="rounded-lg border bg-card p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <dd className="text-title font-bold tabular-nums">
              <DashboardCount count={countByKey.get(key) ?? null} />
            </dd>
            <dt className="text-body-sm text-muted-foreground">{label}</dt>
          </Link>
        ))}
      </dl>
    </section>
  );
}

export function DashboardGlanceSkeleton() {
  return (
    <SkeletonRegion className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {GLANCE_STATS.map(({ key }) => (
        <Skeleton key={key} className="h-[74px] rounded-lg" />
      ))}
    </SkeletonRegion>
  );
}
