import { unstable_noStore as noStore } from "next/cache";
import { Suspense } from "react";
import { Page, PageHeader } from "@/components/layout";
import { CardGridSkeleton } from "@/components/ui/card-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import ShadchanCard from "@/features/shadchanim/components/shadchan-card";
import {
  getMyContactQuota,
  listApprovedShadchanimPage,
  SHADCHANIM_PAGE_SIZE,
} from "@/features/shadchanim/lib/queries";
import { UrlPagination } from "@/components/url-pagination";
import { parsePageParam } from "@/lib/pagination";
import { canBrowseShadchanim } from "@/features/shadchanim/lib/browse-access";
import { getUser, hasRole } from "@/lib/user";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/** כמה שלדי כרטיסים להציג בזמן הטעינה. */
const SKELETON_CARD_COUNT = 6;

type ShadchanimSearchParams = Promise<{ page?: string | string[] }>;

async function ShadchanimList({
  searchParams,
}: {
  searchParams: ShadchanimSearchParams;
}) {
  noStore();
  const requestedPage = parsePageParam((await searchParams).page);
  if (!(await canBrowseShadchanim())) return <ActiveCardRequired />;
  const [result, quota] = await Promise.all([
    listApprovedShadchanimPage(requestedPage),
    getMyContactQuota(),
  ]);

  if (result === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>לא הצלחנו לטעון את רשימת השדכנים</EmptyTitle>
          <EmptyDescription>
            אנא רעננו את הדף או נסו שוב בעוד מספר דקות.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { shadchanim, total, page } = result;
  const user = await getUser();
  // שדכן אינו רואה את עצמו ברשימה (list_approved_shadchanim), ולכן נדמה לו
  // שאינו מופיע. הוא כן מופיע לכל השאר - ההסבר והקישור לפרופיל שלו
  const ownProfileNotice =
    user && hasRole(user, "shadchan") ? (
      <p
        className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-body-sm"
        data-testid="shadchanim-own-profile-notice"
      >
        הפרופיל שלך מופיע ברשימה לכל המשתמשים (אינו מוצג לך עצמך).{" "}
        <Link href={`/app/shadchanim/${user.id}`} className="underline">
          לצפייה בפרופיל שלך
        </Link>
      </p>
    ) : null;
  if (shadchanim.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>עדיין אין שדכנים ברשימה</EmptyTitle>
          <EmptyDescription>שדכנים שיאושרו במערכת יופיעו כאן.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {ownProfileNotice}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shadchanim.map((shadchan) => (
          <li key={shadchan.id} data-testid="shadchan-list-item">
            <ShadchanCard shadchan={shadchan} quota={quota} />
          </li>
        ))}
      </ul>
      <UrlPagination
        page={page}
        total={total}
        pageSize={SHADCHANIM_PAGE_SIZE}
      />
    </>
  );
}

/** משתמש בלי כרטיס פעיל וגלוי: הסבר והפניה לכרטיסים שלו */
function ActiveCardRequired() {
  return (
    <Empty data-testid="shadchanim-active-card-required">
      <EmptyHeader>
        <EmptyTitle>רשימת השדכנים פתוחה לבעלי כרטיס פעיל</EmptyTitle>
        <EmptyDescription>
          כדי לצפות בשדכנים ולפנות אליהם צריך כרטיס פעיל שאושר בידי ההנהלה
          וגלוי לכל השדכנים. כרטיס שממתין לאישור, מושהה או הוצא משידוכים אינו
          נחשב.
        </EmptyDescription>
      </EmptyHeader>
      <Button asChild>
        <Link href="/app">לכרטיסים שלי</Link>
      </Button>
    </Empty>
  );
}

/** רשימת השדכנים המאושרים: לשדכנים, למנהלים, לאנשי צוות ולבעלי כרטיס פעיל וגלוי. */
export default function ShadchanimPage({
  searchParams,
}: {
  searchParams: ShadchanimSearchParams;
}) {
  return (
    <Page>
      <PageHeader
        title="שדכנים"
        description="שדכנים ושדכניות שאושרו במערכת. אפשר לצפות בפרופיל המלא ולפנות אליהם."
      />
      <Suspense
        fallback={<CardGridSkeleton count={SKELETON_CARD_COUNT} lines={3} />}
      >
        <ShadchanimList searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}
