import { Skeleton } from "@/components/ui/skeleton";

/** כמה כרטיסי הצעה מסומנים בשלד הרשימה */
const DEFAULT_SKELETON_COUNT = 3;

function SideSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

/** שלד רשימת הצעות, במבנה של ShadchanProposalCard */
export default function ShadchanProposalListSkeleton({
  count = DEFAULT_SKELETON_COUNT,
}: {
  count?: number;
}) {
  return (
    <div role="status" aria-label="טוען" className="mt-6 grid gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="box @container flex flex-col gap-4 border p-4 md:p-5"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="grid gap-4 @lg:grid-cols-2 @lg:gap-0">
            <SideSkeleton className="@lg:pe-5" />
            <SideSkeleton className="border-t pt-4 @lg:border-s @lg:border-t-0 @lg:ps-5 @lg:pt-0" />
          </div>
          <div className="flex justify-end border-t pt-3">
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
