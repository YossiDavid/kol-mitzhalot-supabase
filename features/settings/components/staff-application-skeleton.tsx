import { Page, PageHeader } from "@/components/layout";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

import {
  STAFF_PAGE_DESCRIPTION,
  STAFF_PAGE_TITLE,
} from "@/features/settings/lib/staff-application-schema";

/** כמה שורות שיוך מסומנות בשלד הטעינה. */
const SKELETON_AFFILIATION_COUNT = 2;

/** שלד עמוד הבקשה, זהה במבנה לתוכן האמיתי כדי שלא תהיה קפיצה. */
export function StaffPageSkeleton() {
  return (
    <Page width="form">
      <PageHeader
        title={STAFF_PAGE_TITLE}
        description={STAFF_PAGE_DESCRIPTION}
      />
      <SkeletonRegion>
        <CardSkeleton footer>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-28 md:h-8" />
            </div>
            {Array.from({ length: SKELETON_AFFILIATION_COUNT }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start"
              >
                <Skeleton className="h-11 flex-1 md:h-10" />
                <Skeleton className="h-11 flex-1 md:h-10" />
                <Skeleton className="size-11 shrink-0 md:size-10" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      </SkeletonRegion>
    </Page>
  );
}
