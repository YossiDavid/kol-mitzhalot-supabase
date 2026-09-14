import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import ShadchanCard from "@/features/shadchanim/components/shadchan-card";
import {
  DASHBOARD_SHADCHANIM_LIMIT,
  getMyContactQuota,
  getShadchanimWhoActedForMe,
} from "@/features/shadchanim/lib/queries";
import { Star } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const GRID_CLASS = "grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3";
const SKELETON_CARDS = 3;

function ShadchanimEmptyState() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>עדיין אין שדכנים שפעלו בקו”ח של ילדיך</EmptyTitle>
        <EmptyDescription>
          באפשרותך לפנות לשדכנים מתוך רשימת השדכנים המומלצים של המערכת
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/app/shadchanim">
            <Star />
            לכל השדכנים המומלצים
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function ShadchanimGridSkeleton() {
  return (
    <div className={GRID_CLASS} aria-busy>
      {Array.from({ length: SKELETON_CARDS }, (_, i) => (
        <Skeleton key={i} className="h-64 rounded-2xl" />
      ))}
    </div>
  );
}

async function ShadchanimActedForMe() {
  const [shadchanim, quota] = await Promise.all([
    getShadchanimWhoActedForMe(DASHBOARD_SHADCHANIM_LIMIT),
    getMyContactQuota(),
  ]);

  if (shadchanim === null) {
    return (
      <p className="pt-2 text-body-sm text-destructive" role="alert">
        לא הצלחנו לטעון כרגע את השדכנים שפעלו בשבילך. נסו לרענן את העמוד.
      </p>
    );
  }

  if (shadchanim.length === 0) return <ShadchanimEmptyState />;

  return (
    <div className={GRID_CLASS}>
      {shadchanim.map((shadchan) => (
        <ShadchanCard
          key={shadchan.id}
          shadchan={shadchan}
          quota={quota}
          actionTypes={shadchan.actionTypes}
        />
      ))}
    </div>
  );
}

/**
 * "שדכנים שפעלו בשבילך": fetches its own data (get_shadchanim_who_acted_for_me)
 * and streams in behind a skeleton, so the rest of the dashboard doesn't wait for it.
 */
export default function ShadchanimList() {
  return (
    <Suspense fallback={<ShadchanimGridSkeleton />}>
      <ShadchanimActedForMe />
    </Suspense>
  );
}
