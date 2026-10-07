import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";

import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  PENDING_QUEUES,
  loadAllCounts,
  type PendingQueue,
} from "../../lib/dashboard-stats";
import { DashboardCount } from "./dashboard-count";

function PendingCard({
  queue,
  count,
}: {
  queue: PendingQueue;
  count: number | null;
}) {
  const Icon = queue.icon;
  const hasPending = count !== null && count > 0;
  const isEmpty = count === 0;

  return (
    <Link
      href={queue.href}
      data-testid={`pending-${queue.key}`}
      data-count={count ?? "error"}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        hasPending
          ? "border-primary bg-primary-muted"
          : "bg-card text-muted-foreground",
      )}
    >
      <Icon className="size-6 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span
          className={cn("block font-semibold", hasPending && "text-foreground")}
        >
          {queue.title}
        </span>
        {isEmpty && (
          <span className="block text-body-sm">{queue.emptyText}</span>
        )}
      </span>
      <span
        data-testid={`pending-count-${queue.key}`}
        className={cn(
          "text-title font-bold tabular-nums",
          hasPending && "text-primary",
        )}
      >
        <DashboardCount count={count} />
      </span>
    </Link>
  );
}

/** "ממתין לטיפולך": כל תור לפי ההגדרה של הדף שאליו הוא מקשר */
export async function DashboardPending() {
  noStore();
  const entries = await loadAllCounts(PENDING_QUEUES);
  const countByKey = new Map(entries.map(({ key, count }) => [key, count]));

  return (
    <section aria-labelledby="admin-pending-title" className="space-y-3">
      <h2 id="admin-pending-title" className="text-subtitle font-bold">
        ממתין לטיפולך
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PENDING_QUEUES.map((queue) => (
          <PendingCard
            key={queue.key}
            queue={queue}
            count={countByKey.get(queue.key) ?? null}
          />
        ))}
      </div>
    </section>
  );
}

export function DashboardPendingSkeleton() {
  return (
    <SkeletonRegion className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {PENDING_QUEUES.map(({ key }) => (
        <Skeleton key={key} className="h-[74px] rounded-lg" />
      ))}
    </SkeletonRegion>
  );
}
