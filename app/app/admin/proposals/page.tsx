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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loadProposalsReport,
  type ProposalEventRow,
} from "@/features/admin/lib/proposals-report";
import {
  PROPOSALS_PAGE_SIZE,
  PROPOSALS_REPORT_PATH,
  parseProposalsReportQuery,
  proposalsReportHref,
  type ProposalsReportQuery,
} from "@/features/admin/lib/proposals-report-query";
import {
  SHIDDUCH_STATUS_BADGE_VARIANT,
  SHIDDUCH_STATUS_LABELS,
  isShidduchStatus,
} from "@/features/shidduchim/lib/status";

// מספר שורות השלד בזמן הטעינה - מקרב את גובה הטבלה האמיתית
const FALLBACK_ROW_COUNT = 6;

// ההרשאה נאכפת בשתי שכבות שאינן תלויות בדף: app/app/admin/layout.tsx מפנה
// החוצה כל מי שאינו מנהל, ומדיניות ה-RLS על shidduch_events מחזירה שורות
// למנהל בלבד.

type ReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SIDE_LABELS: Record<ProposalEventRow["side"], string> = {
  groom: "צד המיועד",
  bride: "צד המיועדת",
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(value));
}

function StatusCell({ row }: { row: ProposalEventRow }) {
  if (row.currentStatus === null) {
    return <span className="text-muted-foreground">נמחקה</span>;
  }
  if (!isShidduchStatus(row.currentStatus)) return row.currentStatus;
  return (
    <Link href={`/app/shidduchim/${row.shidduchId}` as Route}>
      <Badge variant={SHIDDUCH_STATUS_BADGE_VARIANT[row.currentStatus]}>
        {SHIDDUCH_STATUS_LABELS[row.currentStatus]}
      </Badge>
    </Link>
  );
}

function cardLink(id: string, name: string | null) {
  return (
    <Link
      href={`/app/students/${id}` as Route}
      className="font-medium underline-offset-2 hover:underline"
    >
      {name ?? "כרטיס ללא שם"}
    </Link>
  );
}

const COLUMNS: DataTableColumn<ProposalEventRow>[] = [
  {
    key: "when",
    header: "מתי",
    size: "min",
    mobile: "title",
    cell: (row) => formatDateTime(row.createdAt),
  },
  {
    key: "shadchan",
    header: "מי הציע",
    cell: (row) => (
      <Link
        href={`/app/admin/users/${row.shadchanId}` as Route}
        className="font-medium underline-offset-2 hover:underline"
      >
        {row.shadchanName ?? "משתמש ללא שם"}
      </Link>
    ),
  },
  {
    key: "card",
    header: "לאיזה כרטיס",
    cell: (row) => cardLink(row.studentId, row.studentName),
  },
  {
    key: "other",
    header: "הכרטיס המוצע",
    cell: (row) => cardLink(row.otherStudentId, row.otherStudentName),
  },
  {
    key: "side",
    header: "צד",
    size: "min",
    cell: (row) => SIDE_LABELS[row.side],
  },
  {
    key: "status",
    header: "סטטוס נוכחי",
    size: "min",
    cell: (row) => <StatusCell row={row} />,
  },
];

function Filters({ query }: { query: ProposalsReportQuery }) {
  return (
    <form
      method="get"
      action={PROPOSALS_REPORT_PATH}
      className="flex flex-wrap items-end gap-3"
      data-testid="proposals-filters"
    >
      <div className="grid min-w-40 flex-1 gap-2">
        <Label htmlFor="filter-shadchan">שדכן</Label>
        <Input
          id="filter-shadchan"
          name="shadchan"
          defaultValue={query.shadchan}
          placeholder="שם השדכן"
        />
      </div>
      <div className="grid min-w-40 flex-1 gap-2">
        <Label htmlFor="filter-card">כרטיס מקבל</Label>
        <Input
          id="filter-card"
          name="card"
          defaultValue={query.card}
          placeholder="שם הכרטיס"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-from">מתאריך</Label>
        <Input
          id="filter-from"
          name="from"
          type="date"
          defaultValue={query.from}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-to">עד תאריך</Label>
        <Input id="filter-to" name="to" type="date" defaultValue={query.to} />
      </div>
      <Button type="submit">סינון</Button>
      <Button asChild variant="outline">
        <Link href={PROPOSALS_REPORT_PATH as Route}>ניקוי</Link>
      </Button>
    </form>
  );
}

function Pager({
  query,
  lastPage,
}: {
  query: ProposalsReportQuery;
  lastPage: number;
}) {
  if (lastPage <= 1) return null;
  const hrefFor = (page: number) =>
    proposalsReportHref({ ...query, page }) as Route;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-8">
      {query.page <= 1 ? (
        <Button variant="outline" size="sm" disabled type="button">
          הקודם
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(query.page - 1)}>הקודם</Link>
        </Button>
      )}
      {query.page >= lastPage ? (
        <Button variant="outline" size="sm" disabled type="button">
          הבא
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(query.page + 1)}>הבא</Link>
        </Button>
      )}
    </div>
  );
}

async function ProposalsContent({ searchParams }: ReportPageProps) {
  noStore();
  const query = parseProposalsReportQuery(await searchParams);

  let report;
  try {
    report = await loadProposalsReport(query);
  } catch (err) {
    console.error("[admin/proposals]", err);
    return (
      <Page>
        <PageHeader title="דוח הצעות" description="אירעה שגיאה בטעינת הדוח" />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <p className="text-body-sm">טעינת הדוח נכשלה. נסו לרענן את הדף.</p>
        </div>
      </Page>
    );
  }

  const { rows, total } = report;
  const lastPage = Math.max(1, Math.ceil(total / PROPOSALS_PAGE_SIZE));
  const firstShown = (query.page - 1) * PROPOSALS_PAGE_SIZE + 1;

  return (
    <Page>
      <PageHeader
        title="דוח הצעות"
        count={total}
        description="כל פעם שכרטיס קיבל הצעה, מי שלח אותה ומה מצבה כיום"
      />
      <Filters query={query} />
      {rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>לא נמצאו הצעות לפי הסינון</EmptyTitle>
            <EmptyDescription>
              נסו להרחיב את טווח התאריכים או לנקות את הסינון
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-muted-foreground">
            <span>
              מציג {firstShown}–{firstShown + rows.length - 1} מתוך {total}
            </span>
            <span>
              עמוד {query.page} מתוך {lastPage}
            </span>
          </div>
          <DataTable
            className="pt-2"
            caption="יומן ההצעות"
            breakpoint="xl"
            columns={COLUMNS}
            rows={rows}
            getRowKey={(row) => row.id}
          />
          <Pager query={query} lastPage={lastPage} />
        </div>
      )}
    </Page>
  );
}

function ProposalsFallback() {
  return (
    <Page>
      <PageHeader
        title="דוח הצעות"
        description="כל פעם שכרטיס קיבל הצעה, מי שלח אותה ומה מצבה כיום"
      />
      <DataTableSkeleton
        breakpoint="xl"
        rows={FALLBACK_ROW_COUNT}
        columns={COLUMNS.length}
      />
    </Page>
  );
}

export default function ProposalsReportPage(props: ReportPageProps) {
  return (
    <Suspense fallback={<ProposalsFallback />}>
      <ProposalsContent {...props} />
    </Suspense>
  );
}
