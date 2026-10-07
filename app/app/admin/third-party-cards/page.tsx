import { Suspense } from "react";
import type { Route } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Page, PageHeader } from "@/components/layout";
import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ThirdPartyApprovalToggle } from "@/features/admin/components/third-party-approval-controls";
import {
  THIRD_PARTY_CARDS_PAGE_SIZE,
  loadThirdPartyCards,
  parseThirdPartyCardsQuery,
  thirdPartyCardsHref,
  type ThirdPartyCardRow,
  type ThirdPartyCardsQuery,
} from "@/features/admin/lib/third-party-cards";

const FALLBACK_ROW_COUNT = 5;

// ההרשאה נאכפת ב-app/app/admin/layout.tsx; הנתונים נשלפים ב-service role
// ולכן הדף אינו נגיש מחוץ לנתיב הזה.

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_TITLE = "כרטיסים שמולאו על ידי צד שלישי";
const PAGE_DESCRIPTION =
  "אישור הצגת נתונים מלאים ואפשרות לשלוח הצעות, בנפרד לכל כרטיס. כברירת מחדל מוצגים הכרטיסים שממתינים לאישור כלשהו.";

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function knowsWellLabel(value: boolean | null): string {
  if (value === null) return "לא נענה";
  return value ? "כן" : "לא";
}

const COLUMNS: DataTableColumn<ThirdPartyCardRow>[] = [
  {
    key: "candidate",
    header: "מועמד/ת",
    size: "grow",
    mobile: "title",
    cell: (row) => (
      <Link
        href={`/app/students/${row.id}` as Route}
        className="font-medium text-primary hover:underline"
      >
        {row.candidateName}
      </Link>
    ),
  },
  {
    key: "filler",
    header: "ממלא/ת",
    cell: (row) => (
      <div data-testid={`filler-${row.id}`}>
        <p className="font-medium">{row.fillerName || "-"}</p>
        <p className="text-caption text-muted-foreground">
          {row.fillerRelation}
        </p>
        {row.fillerPhone && (
          <p className="text-caption text-muted-foreground">
            {row.fillerPhone}
          </p>
        )}
        <p className="text-caption text-muted-foreground">
          מכיר/ה היטב: {knowsWellLabel(row.knowsWell)}
        </p>
      </div>
    ),
  },
  {
    key: "reason",
    header: "מדוע מולא על ידו",
    size: "grow",
    className: "text-muted-foreground",
    cell: (row) => (
      <span data-testid={`reason-${row.id}`}>{row.fillReason || "-"}</span>
    ),
  },
  {
    key: "created",
    header: "נוצר",
    size: "min",
    className: "text-muted-foreground",
    cell: (row) => formatDate(row.createdAt),
  },
  {
    key: "full-display",
    header: "הצגת נתונים מלאים",
    cell: (row) => (
      <ThirdPartyApprovalToggle
        studentId={row.id}
        kind="full_display"
        state={{ approvedAt: row.fullDisplayApprovedAt, approvedByName: null }}
      />
    ),
  },
  {
    key: "proposals",
    header: "אפשרות לשלוח הצעות",
    cell: (row) => (
      <ThirdPartyApprovalToggle
        studentId={row.id}
        kind="proposals"
        state={{ approvedAt: row.proposalsApprovedAt, approvedByName: null }}
      />
    ),
  },
];

function FilterLinks({ query }: { query: ThirdPartyCardsQuery }) {
  return (
    <div className="flex gap-2" role="group" aria-label="סינון הכרטיסים">
      <Button
        asChild
        size="sm"
        variant={query.filter === "pending" ? "default" : "outline"}
      >
        <Link
          href={thirdPartyCardsHref({ page: 1, filter: "pending" }) as Route}
        >
          ממתינים לאישור
        </Link>
      </Button>
      <Button
        asChild
        size="sm"
        variant={query.filter === "all" ? "default" : "outline"}
      >
        <Link href={thirdPartyCardsHref({ page: 1, filter: "all" }) as Route}>
          כל הכרטיסים
        </Link>
      </Button>
    </div>
  );
}

function PageLinks({
  query,
  total,
}: {
  query: ThirdPartyCardsQuery;
  total: number;
}) {
  const lastPage = Math.max(1, Math.ceil(total / THIRD_PARTY_CARDS_PAGE_SIZE));
  if (lastPage === 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3" aria-label="עמודים">
      {query.page > 1 && (
        <Button asChild size="sm" variant="outline">
          <Link
            href={
              thirdPartyCardsHref({ ...query, page: query.page - 1 }) as Route
            }
          >
            הקודם
          </Link>
        </Button>
      )}
      <span className="text-body-sm text-muted-foreground">
        עמוד {query.page} מתוך {lastPage}
      </span>
      {query.page < lastPage && (
        <Button asChild size="sm" variant="outline">
          <Link
            href={
              thirdPartyCardsHref({ ...query, page: query.page + 1 }) as Route
            }
          >
            הבא
          </Link>
        </Button>
      )}
    </nav>
  );
}

async function ThirdPartyCardsContent({ searchParams }: PageProps) {
  noStore();
  const query = parseThirdPartyCardsQuery(await searchParams);
  const { rows, total } = await loadThirdPartyCards(query);

  return (
    <Page>
      <PageHeader
        title={PAGE_TITLE}
        count={total}
        description={PAGE_DESCRIPTION}
      />
      <FilterLinks query={query} />
      <DataTable
        caption={PAGE_TITLE}
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.id}
        emptyState={
          <Empty size="compact" surface={false}>
            <EmptyHeader>
              <EmptyTitle>אין כרטיסים להצגה</EmptyTitle>
              <EmptyDescription>
                כרטיס חדש שימולא על ידי צד שלישי יופיע כאן ויישלח גם כהתראה
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />
      <PageLinks query={query} total={total} />
    </Page>
  );
}

function ThirdPartyCardsFallback() {
  return (
    <Page>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <DataTableSkeleton rows={FALLBACK_ROW_COUNT} columns={6} />
    </Page>
  );
}

export default function ThirdPartyCardsPage(props: PageProps) {
  return (
    <Suspense fallback={<ThirdPartyCardsFallback />}>
      <ThirdPartyCardsContent {...props} />
    </Suspense>
  );
}
