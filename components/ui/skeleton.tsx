import { cn } from "@/lib/utils";

const DEFAULT_LOADING_LABEL = "טוען";
const DEFAULT_LIST_ROW_COUNT = 4;

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-primary-muted", className)}
      {...props}
    />
  );
}

/**
 * עוטף שלד טעינה אחד: role="status" עם שם נגיש, כדי שקורא מסך ישמע "טוען"
 * פעם אחת ולא על כל פס. הבדיקות ממתינות לו (getByRole("status", {name: "טוען"})).
 */
function SkeletonRegion({
  label = DEFAULT_LOADING_LABEL,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      data-slot="skeleton-region"
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}

/** שלד רשימה עם קווים מפרידים (רשימות divide-y בתוך Box) */
function ListSkeleton({
  rows = DEFAULT_LIST_ROW_COUNT,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <SkeletonRegion className={cn("divide-y", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 py-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export { Skeleton, SkeletonRegion, ListSkeleton };
