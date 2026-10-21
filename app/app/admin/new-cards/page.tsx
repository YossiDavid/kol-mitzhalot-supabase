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
import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { CardApprovalButtons } from "@/features/admin/components/card-approval-controls";
import {
  NEW_CARDS_FILTER_LABELS,
  NEW_CARDS_PAGE_SIZE,
  loadNewCards,
  loadNewCardsCounts,
  newCardsHref,
  parseNewCardsQuery,
  type NewCardRow,
  type NewCardsFilter,
  type NewCardsQuery,
} from "@/features/admin/lib/new-cards";
import { THIRD_PARTY_CARDS_PATH } from "@/features/admin/lib/third-party-cards";
import { CARD_APPROVAL_LABELS } from "@/features/students/lib/card-approval";
import {
  isThirdPartyCardFor,
  thirdPartyTagLabel,
} from "@/features/students/lib/third-party-card";

const FALLBACK_ROW_COUNT = 5;
const FILTERS: readonly NewCardsFilter[] = ["pending", "rejected", "approved"];

// ההרשאה נאכפת ב-app/app/admin/layout.tsx; הנתונים נשלפים ב-service role
// ולכן הדף אינו נגיש מחוץ לנתיב הזה.

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_TITLE = "כרטיסים חדשים לאישור";
const PAGE_DESCRIPTION =
  'כל כרטיס חדש ממתין כאן לאישור. עד האישור הוא גלוי לבעליו ולמנהלים בלבד, ואי אפשר לשלוח עליו הצעות. דחייה דורשת סיבה, שנשלחת לבעל הכרטיס (אפשר גם לדחות בלי הודעה). כרטיס שנדחה אינו נמחק: הוא בלשונית "נדחו", ואפשר לאשר אותו או להחזיר אותו להמתנה.';

const CARD_FOR_LABELS: Record<string, string> = {
  self: "המועמד/ת עצמו/ה",
  child: "הורה",
  other: "צד שלישי",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function CardTypeCell({ row }: { row: NewCardRow }) {
  if (!isThirdPartyCardFor(row.cardFor)) {
    return <span>{CARD_FOR_LABELS[row.cardFor ?? ""] ?? "לא צוין"}</span>;
  }
  return (
    <div data-testid={`card-type-${row.id}`}>
      <p className="font-medium">
        {thirdPartyTagLabel({
          card_for: row.cardFor,
          third_party_full_display_approved_at:
            row.thirdPartyFullDisplayApprovedAt,
        })}
      </p>
      <Link
        href={THIRD_PARTY_CARDS_PATH as Route}
        className="text-caption text-primary hover:underline"
      >
        לאישורי צד שלישי
      </Link>
    </div>
  );
}

function StatusCell({ row }: { row: NewCardRow }) {
  return (
    <div data-testid={`approval-status-${row.id}`} data-status={row.status}>
      <p className="font-medium">{CARD_APPROVAL_LABELS[row.status]}</p>
      {row.isPaused && (
        <Badge variant="warning" data-testid={`paused-badge-${row.id}`}>
          מושהה
        </Badge>
      )}
      {(row.status === "approved" || row.status === "exclusive") && (
        <p className="text-caption text-muted-foreground">
          {formatDate(row.approvedAt)}
        </p>
      )}
      {row.status === "rejected" && (
        <p className="text-caption text-muted-foreground">
          {formatDate(row.rejectedAt)}: {row.rejectionReason}
        </p>
      )}
    </div>
  );
}

const COLUMNS: DataTableColumn<NewCardRow>[] = [
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
    key: "type",
    header: "מי מילא",
    cell: (row) => <CardTypeCell row={row} />,
  },
  {
    key: "filler",
    header: "פרטי הממלא/ת",
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
        {row.fillerEmail && (
          <p className="text-caption text-muted-foreground">
            {row.fillerEmail}
          </p>
        )}
      </div>
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
    key: "status",
    header: "מצב",
    cell: (row) => <StatusCell row={row} />,
  },
  {
    key: "actions",
    header: "פעולות",
    mobile: "actions",
    cell: (row) => (
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link
            href={`/app/students/${row.id}` as Route}
            aria-label={`צפייה בכרטיס של ${row.candidateName}`}
          >
            <Eye aria-hidden />
            צפייה בכרטיס
          </Link>
        </Button>
        <CardApprovalButtons
          studentId={row.id}
          studentName={row.candidateName}
          status={row.status}
          isPaused={row.isPaused}
        />
      </div>
    ),
  },
];

function FilterLinks({
  query,
  counts,
}: {
  query: NewCardsQuery;
  counts: Record<NewCardsFilter, number | null>;
}) {
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="סינון הכרטיסים"
    >
      {FILTERS.map((filter) => (
        <Button
          key={filter}
          asChild
          size="sm"
          variant={query.filter === filter ? "default" : "outline"}
        >
          <Link
            href={newCardsHref({ page: 1, filter }) as Route}
            data-testid={`new-cards-filter-${filter}`}
          >
            {NEW_CARDS_FILTER_LABELS[filter]}
            {counts[filter] !== null && ` (${counts[filter]})`}
          </Link>
        </Button>
      ))}
    </div>
  );
}

function PageLinks({ query, total }: { query: NewCardsQuery; total: number }) {
  const lastPage = Math.max(1, Math.ceil(total / NEW_CARDS_PAGE_SIZE));
  if (lastPage === 1) return null;
  return (
    <nav className="flex items-center justify-center gap-3" aria-label="עמודים">
      {query.page > 1 && (
        <Button asChild size="sm" variant="outline">
          <Link
            href={newCardsHref({ ...query, page: query.page - 1 }) as Route}
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
            href={newCardsHref({ ...query, page: query.page + 1 }) as Route}
          >
            הבא
          </Link>
        </Button>
      )}
    </nav>
  );
}

const EMPTY_TEXT: Record<NewCardsFilter, string> = {
  pending: "אין כרטיסים שממתינים לאישור",
  rejected: "אין כרטיסים שנדחו",
  approved: "עוד לא אושרו כרטיסים",
};

async function NewCardsContent({ searchParams }: PageProps) {
  noStore();
  const query = parseNewCardsQuery(await searchParams);
  const [{ rows, total }, counts] = await Promise.all([
    loadNewCards(query),
    loadNewCardsCounts(),
  ]);

  return (
    <Page>
      <PageHeader
        title={PAGE_TITLE}
        count={total}
        description={PAGE_DESCRIPTION}
      />
      <FilterLinks query={query} counts={counts} />
      <DataTable
        caption={PAGE_TITLE}
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.id}
        emptyState={
          <Empty size="compact" surface={false}>
            <EmptyHeader>
              <EmptyTitle>{EMPTY_TEXT[query.filter]}</EmptyTitle>
              <EmptyDescription>
                כרטיס חדש שייווצר יופיע כאן ויישלח גם כהתראה
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />
      <PageLinks query={query} total={total} />
    </Page>
  );
}

function NewCardsFallback() {
  return (
    <Page>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
      <DataTableSkeleton rows={FALLBACK_ROW_COUNT} columns={6} />
    </Page>
  );
}

export default function NewCardsPage(props: PageProps) {
  return (
    <Suspense fallback={<NewCardsFallback />}>
      <NewCardsContent {...props} />
    </Suspense>
  );
}
