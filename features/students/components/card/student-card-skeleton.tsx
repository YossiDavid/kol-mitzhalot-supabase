import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

import { InfoTagGrid } from "./info-tag";
import { StudentCardBackLinkPlaceholder } from "./student-card-hero";

// תחת Cache Components כל קריאת runtime (cookies/headers/auth/DB) חייבת לשבת
// מתחת ל-Suspense, ולכן הדף עצמו הוא הקומפוננטה שמתחת לגבול. השלד מחקה את
// מבנה הכרטיס האמיתי (חזרה לרשימה, hero, מקטע פרטים אישיים ורשת 3+1) כדי
// שלא יהיה layout shift ברגע שהתוכן מגיע. כל המידות קבועות - אין כאן שום
// ערך אקראי או תלוי-זמן, כי השלד עצמו מוכן מראש (prerendered).
const SKELETON_INFO_TAGS = 8;
const SKELETON_MAIN_SECTIONS = 2;
const SKELETON_SIDE_SECTIONS = 3;
const SKELETON_SECTION_ROWS = 4;

/** שלד מקטע - אותו משטח (Card) ואותה שורת כותרת כמו ב-CardSection */
function SkeletonSection({ rows }: { rows: number }) {
  return (
    <Card size="sm" aria-hidden>
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </div>
    </Card>
  );
}

export function StudentCardSkeleton() {
  return (
    <SkeletonRegion className="min-h-screen space-y-6 text-right">
      {/* Hero - מרקאפ סטטי זהה לזה שבתוכן האמיתי */}
      <div
        aria-hidden
        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <Skeleton className="h-20 w-20 shrink-0 rounded-full sm:h-24 sm:w-24" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        {/* חזרה לרשימה, פעולה ראשית ותפריט "עוד פעולות" - אותה שורה */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <StudentCardBackLinkPlaceholder />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      {/* פרטים אישיים */}
      <Card size="sm" aria-hidden>
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-6 w-32" />
        </div>
        <InfoTagGrid>
          {Array.from({ length: SKELETON_INFO_TAGS }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </InfoTagGrid>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-3">
          {Array.from({ length: SKELETON_MAIN_SECTIONS }, (_, index) => (
            <SkeletonSection key={index} rows={SKELETON_SECTION_ROWS} />
          ))}
        </div>
        <div className="space-y-6">
          {Array.from({ length: SKELETON_SIDE_SECTIONS }, (_, index) => (
            <SkeletonSection key={index} rows={2} />
          ))}
        </div>
      </div>

      <span className="sr-only">טוען כרטיס מיועד…</span>
    </SkeletonRegion>
  );
}
