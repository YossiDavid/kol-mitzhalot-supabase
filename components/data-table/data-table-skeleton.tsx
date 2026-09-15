import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { DATA_TABLE_BREAKPOINT_CLASS, type DataTableProps } from "./data-table";

const DEFAULT_ROW_COUNT = 5;
const DEFAULT_COLUMN_COUNT = 5;
/** כרטיסי מובייל - פחות מהשורות, כי כל כרטיס גבוה יותר */
const MAX_MOBILE_CARDS = 3;

type DataTableSkeletonProps = Pick<
  DataTableProps<unknown>,
  "breakpoint" | "surface" | "className"
> & {
  rows?: number;
  columns?: number;
};

/**
 * שלד טעינה באותה צורה של DataTable: טבלה (כותרות + שורות) מה-breakpoint,
 * וכרטיסים מתחתיו. אותו surface כמו הטבלה שתחליף אותו.
 */
export function DataTableSkeleton({
  rows = DEFAULT_ROW_COUNT,
  columns = DEFAULT_COLUMN_COUNT,
  breakpoint = "md",
  surface = true,
  className,
}: DataTableSkeletonProps) {
  const visibility = DATA_TABLE_BREAKPOINT_CLASS[breakpoint];
  const columnKeys = Array.from({ length: columns }, (_, index) => index);

  return (
    <SkeletonRegion data-slot="data-table-skeleton" className={className}>
      <div
        aria-hidden
        className={cn(visibility.table, surface && "box px-2 py-1")}
      >
        <div className="flex h-11 items-center gap-4 border-b px-2">
          {columnKeys.map((key) => (
            <Skeleton key={key} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex h-13 items-center gap-4 border-b px-2 last:border-0"
          >
            {columnKeys.map((key) => (
              <Skeleton
                key={key}
                className={cn("h-4 flex-1", key === 0 && "max-w-40")}
              />
            ))}
          </div>
        ))}
      </div>
      <ul aria-hidden className={cn("flex flex-col gap-3", visibility.cards)}>
        {Array.from(
          { length: Math.min(rows, MAX_MOBILE_CARDS) },
          (_, index) => (
            <li
              key={index}
              className={cn(
                "flex flex-col gap-3 p-4",
                surface ? "box" : "rounded-lg border",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </li>
          ),
        )}
      </ul>
    </SkeletonRegion>
  );
}
