import { Suspense } from "react";
import type { Route } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { Box, Page, PageHeader } from "@/components/layout";
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
import { CardReportActions } from "@/features/admin/components/card-report-actions";
import {
  loadCardReports,
  parseCardReportStatus,
  type CardReportRow,
  type CardReportStatus,
} from "@/features/admin/lib/card-reports";
import { CARD_REPORT_REASON_LABELS } from "@/features/students/lib/card-report";

// ההרשאה נאכפת בשתי שכבות שאינן תלויות בדף: app/app/admin/layout.tsx מפנה
// החוצה כל מי שאינו מנהל, ו-RLS על card_reports מחזיר שורות למנהל בלבד.

const TITLE = "דיווחים על כרטיסים";
const DESCRIPTION =
  "משתמשים שדיווחו על כרטיס. אפשר לסמן דיווח כטופל ולהשהות את הכרטיס המדווח.";
const FALLBACK_ROW_COUNT = 4;

const STATUS_TABS: readonly { value: CardReportStatus; label: string }[] = [
  { value: "open", label: "פתוחים" },
  { value: "handled", label: "טופלו" },
];

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

const COLUMNS: DataTableColumn<CardReportRow>[] = [
  {
    key: "student",
    header: "כרטיס",
    size: "grow",
    mobile: "title",
    cell: (report) =>
      report.studentName ? (
        <>
          <Link
            href={`/app/students/${report.studentId}` as Route}
            className="font-medium underline-offset-2 hover:underline"
          >
            {report.studentName}
          </Link>
          {report.isStudentPaused && (
            <span className="block text-caption text-warning-muted-foreground">
              מושהה על ידי הנהלה
            </span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">כרטיס לא נמצא</span>
      ),
  },
  {
    key: "reporter",
    header: "מדווח",
    cell: (report) => (
      <>
        <span className="font-medium">
          {report.reporterName ?? "משתמש לא מזוהה"}
        </span>
        {report.reporterEmail && (
          <span className="block text-caption font-normal wrap-anywhere text-muted-foreground">
            {report.reporterEmail}
          </span>
        )}
      </>
    ),
  },
  {
    key: "reason",
    header: "סיבה",
    cell: (report) => CARD_REPORT_REASON_LABELS[report.reason],
  },
  {
    key: "details",
    header: "פירוט",
    size: "grow",
    className: "text-muted-foreground wrap-anywhere",
    cell: (report) => report.details ?? "-",
  },
  {
    key: "created",
    header: "תאריך",
    className: "text-muted-foreground",
    cell: (report) => formatDate(report.createdAt),
  },
  {
    key: "actions",
    header: <span className="sr-only">פעולות</span>,
    size: "min",
    mobile: "actions",
    cell: (report) => (
      <CardReportActions
        reportId={report.id}
        studentId={report.studentId}
        studentName={report.studentName ?? "הכרטיס"}
        isOpen={report.status === "open"}
        isPaused={report.isStudentPaused}
      />
    ),
  },
];

async function CardReportsContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  noStore();
  const { status: rawStatus } = await searchParams;
  const status = parseCardReportStatus(rawStatus);

  let reports: CardReportRow[] = [];
  try {
    reports = await loadCardReports(status);
  } catch {
    return (
      <Page>
        <PageHeader title={TITLE} description="אירעה שגיאה בטעינת הדיווחים" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={TITLE}
        count={reports.length}
        description={DESCRIPTION}
      />
      <Box className="space-y-4">
        <nav aria-label="סינון לפי סטטוס" className="flex gap-2">
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.value}
              asChild
              size="sm"
              variant={tab.value === status ? "default" : "outline"}
            >
              <Link
                href={`/app/admin/card-reports?status=${tab.value}` as Route}
                aria-current={tab.value === status ? "page" : undefined}
                data-testid={`card-reports-tab-${tab.value}`}
              >
                {tab.label}
              </Link>
            </Button>
          ))}
        </nav>
        <DataTable
          surface={false}
          caption="דיווחים על כרטיסים"
          columns={COLUMNS}
          rows={reports}
          getRowKey={(report) => report.id}
          emptyState={
            <Empty size="compact" surface={false}>
              <EmptyHeader>
                <EmptyTitle>
                  {status === "open"
                    ? "אין דיווחים פתוחים"
                    : "אין דיווחים שטופלו"}
                </EmptyTitle>
                <EmptyDescription>
                  דיווח חדש יופיע כאן ויישלח אליכם גם כהתראה
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </Box>
    </Page>
  );
}

export default function CardReportsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <Page>
          <PageHeader title={TITLE} description={DESCRIPTION} />
          <Box>
            <DataTableSkeleton
              surface={false}
              rows={FALLBACK_ROW_COUNT}
              columns={4}
            />
          </Box>
        </Page>
      }
    >
      <CardReportsContent searchParams={searchParams} />
    </Suspense>
  );
}
