import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

const SKELETON_SECTION_COUNT = 3;

/** שלד מקטע בלוח הבקרה: כותרת DashboardSection, כפתור ומשטח תוכן */
function DashboardSectionSkeleton() {
  return (
    <section aria-hidden>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44 md:h-9" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-11 w-32 md:h-10" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </section>
  );
}

export default function DashboardSkeleton() {
  return (
    <SkeletonRegion label="טוען את לוח הבקרה" className="space-y-10">
      {Array.from({ length: SKELETON_SECTION_COUNT }, (_, i) => (
        <DashboardSectionSkeleton key={i} />
      ))}
    </SkeletonRegion>
  );
}
