import Section from "@/components/layout/section";
import { Skeleton } from "@/components/ui/skeleton";
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
    .select(`*,employment_history(*),partner_preferences(*)`)
    .in("id", user?.user_metadata?.favorites || []);

  return <ShiduchDesk initialFavorites={favorites.data || []} />;
}

/** שלד שולחן העבודה: אזור השידוך למעלה, ורצועת המועדפים בתחתית. */
function ShiduchDeskSkeleton() {
  return (
    <div role="status" aria-label="טוען" className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: SKELETON_FAVORITE_COUNT }, (_, i) => (
          <Skeleton key={i} className="h-40 w-56 shrink-0 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <Section containerClassName="py-4 md:py-10">
      <h1 className="text-center">לוח עבודה ליצירת שידוכים</h1>
      <p className="mx-auto max-w-2xl text-center text-balance">
        המועדפים שהוספתם מופיעים בתחתית הלוח. כדי להוסיף אותם לשידוך חדש פשוט יש
        לגרור את הכרטיס אל עבר התיבה הייעודית או ללחוץ על כפתור ״הוספה לשידוך״
        בתחתית הכרטיס
      </p>
      {/* שולחן העבודה עצמו (client) תלוי במועדפים של המשתמש */}
      <Suspense fallback={<ShiduchDeskSkeleton />}>
        <ShiduchDeskContent />
      </Suspense>
    </Section>
  );
}
