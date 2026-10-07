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
  listApprovedShadchanim,
} from "@/features/shadchanim/lib/queries";

/** כמה שלדי כרטיסים להציג בזמן הטעינה. */
const SKELETON_CARD_COUNT = 6;

async function ShadchanimList() {
  noStore();
  const [shadchanim, quota] = await Promise.all([
    listApprovedShadchanim(),
    getMyContactQuota(),
  ]);

  if (shadchanim === null) {
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
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {shadchanim.map((shadchan) => (
        <li key={shadchan.id} data-testid="shadchan-list-item">
          <ShadchanCard shadchan={shadchan} quota={quota} />
        </li>
      ))}
    </ul>
  );
}

/** רשימת השדכנים המאושרים. פתוחה לכל משתמש מחובר, כמו הפרופיל הציבורי של שדכן. */
export default function ShadchanimPage() {
  return (
    <Page>
      <PageHeader
        title="שדכנים"
        description="שדכנים ושדכניות שאושרו במערכת. אפשר לצפות בפרופיל המלא ולפנות אליהם."
      />
      <Suspense
        fallback={<CardGridSkeleton count={SKELETON_CARD_COUNT} lines={3} />}
      >
        <ShadchanimList />
      </Suspense>
    </Page>
  );
}
