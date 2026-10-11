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

/** רשימת השדכנים המאושרים. פתוחה לכל משתמש מחובר, כמו הפרופיל הציבורי של שדכן. */
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
