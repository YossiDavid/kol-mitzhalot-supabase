import { Page, PageHeader } from "@/components/layout";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { DESK_STUDENT_SELECT } from "@/features/shidduchim/lib/desk-student-select";
import ShiduchDesk from "@/features/shidduchim/components/shiduch-desk";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/user";
import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";

/** כמה כרטיסי מועדפים מסומנים בשלד שולחן העבודה. */
const SKELETON_FAVORITE_COUNT = 4;

async function ShiduchDeskContent() {
  noStore();
  const supabase = await createClient();

  const user = await getUser();

  const favorites = await supabase
    .from("students")
    .select(DESK_STUDENT_SELECT)
    .in("id", user?.user_metadata?.favorites || []);

  return <ShiduchDesk initialFavorites={favorites.data || []} />;
}

/** שלד שולחן העבודה: אזור השידוך למעלה, ורצועת המועדפים בתחתית. */
function ShiduchDeskSkeleton() {
  return (
    <SkeletonRegion className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: SKELETON_FAVORITE_COUNT }, (_, i) => (
          <Skeleton key={i} className="h-40 w-56 shrink-0 rounded-xl" />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export default function CanvasPage() {
  return (
    <Page>
      <PageHeader
        title="לוח עבודה ליצירת שידוכים"
        description="המועדפים שהוספתם מופיעים בתחתית הלוח. כדי להוסיף אותם לשידוך חדש אפשר לגרור את הכרטיס אל התיבה הייעודית, ללחוץ עליו לחיצה כפולה (או Enter כשהוא בפוקוס), או ללחוץ על כפתור ״שיבוץ״ בתחתית הכרטיס. שיבוץ מחליף את מי שכבר נמצא במשבצת"
      />
      {/* שולחן העבודה עצמו (client) תלוי במועדפים של המשתמש */}
      <Suspense fallback={<ShiduchDeskSkeleton />}>
        <ShiduchDeskContent />
      </Suspense>
    </Page>
  );
}
