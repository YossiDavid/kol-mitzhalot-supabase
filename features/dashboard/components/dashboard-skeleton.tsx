import { Section } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_SECTION_COUNT = 3;

function DashboardSectionSkeleton() {
  return (
    <Section>
      <div className="col-span-full mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="col-span-full h-40 rounded-2xl" />
    </Section>
  );
}

export default function DashboardSkeleton() {
  return (
    <div role="status" aria-label="טוען את לוח הבקרה" className="space-y-10">
      {Array.from({ length: SKELETON_SECTION_COUNT }, (_, i) => (
        <DashboardSectionSkeleton key={i} />
      ))}
    </div>
  );
}
