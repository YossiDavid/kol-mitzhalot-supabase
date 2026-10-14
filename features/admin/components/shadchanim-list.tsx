import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Route } from "next";
import Link from "next/link";
import { applicationStatusVariant } from "@/lib/application-status";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  ShadchanimPagination,
  ShadchanimPerPageSelect,
} from "@/features/admin/components/shadchanim-pagination";
import type { AdminShadchanimQuery } from "@/features/admin/lib/shadchanim-query";
import { getShadchanimList } from "@/features/admin/lib/shadchanim";
import { Suspense } from "react";

type ShadchanRow = Awaited<
  ReturnType<typeof getShadchanimList>
>["rows"][number];

/** ערך חסר בטבלה (לעולם לא "לא זמין") */
const MISSING_VALUE = "—";
const TABLE_COLUMN_COUNT = 8;

/** תאריך בלבד, בלי שעה */
function formatDate(dateString: string | null): string {
  if (!dateString) return MISSING_VALUE;
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateString));
}

function fullNameOf(shadchan: ShadchanRow): string {
  return (
    [shadchan.firstName, shadchan.lastName].filter(Boolean).join(" ").trim() ||
    MISSING_VALUE
  );
}

/** שם מלא, ומתחתיו סימון לשדכן מאושר שהתיאור שלו חסר או קצר */
function ShadchanName({ shadchan }: { shadchan: ShadchanRow }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{fullNameOf(shadchan)}</span>
      {shadchan.hasMissingOrShortDescription && (
        <Badge
          variant="outline"
          className="text-muted-foreground"
          data-testid="short-description-badge"
        >
          תיאור חסר/קצר
        </Badge>
      )}
    </span>
  );
}

const SHADCHAN_COLUMNS: DataTableColumn<ShadchanRow>[] = [
  {
    key: "status",
    header: "סטטוס",
    size: "min",
    mobile: "aside",
    cell: (shadchan) => (
      <Badge variant={applicationStatusVariant(shadchan.applicationStatus)}>
        {shadchan.applicationStatusLabel}
      </Badge>
    ),
  },
  {
    key: "name",
    header: "שם",
    // במובייל השם הוא כותרת הכרטיס (mobileTitle)
    mobile: "hidden",
    cell: (shadchan) => <ShadchanName shadchan={shadchan} />,
  },
  {
    key: "email",
    header: "אימייל",
    size: "grow",
    className: "wrap-anywhere",
    cell: (shadchan) => shadchan.email || MISSING_VALUE,
  },
  {
    key: "joined",
    header: "הצטרף",
    size: "min",
    cell: (shadchan) => formatDate(shadchan.createdAt),
  },
  {
    key: "total",
    header: "הצעות שנוצרו",
    size: "min",
    align: "center",
    cell: (shadchan) => shadchan.totalShidduchim,
  },
  {
    key: "completed",
    header: "הצעות שנסגרו",
    size: "min",
    align: "center",
    cell: (shadchan) => shadchan.completedShidduchim,
  },
  {
    key: "last-activity",
    header: "פעילות אחרונה",
    size: "min",
    cell: (shadchan) => formatDate(shadchan.lastActivityAt),
  },
  {
    key: "edit",
    header: "פעולות",
    size: "min",
    mobile: "actions",
    cell: (shadchan) => (
      <Button asChild variant="outline" size="sm">
        <Link href={`/app/admin/shadchanim/${shadchan.id}/edit` as Route}>
          עריכת פרופיל
        </Link>
      </Button>
    ),
  },
];

export function ShadchanimListFallback() {
  return (
    <DataTableSkeleton
      breakpoint="lg"
      columns={TABLE_COLUMN_COUNT}
      className="pt-2"
    />
  );
}

export async function ShadchanimList({
  query,
}: {
  query: AdminShadchanimQuery;
}) {
  const {
    rows: stats,
    total,
    page,
    perPage,
    lastPage,
  } = await getShadchanimList(query);

  if (total === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>לא נמצאו שדכנים במערכת</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-muted-foreground">
        <span>
          מציג {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} מתוך{" "}
          {total}
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <span>
            עמוד {page} מתוך {lastPage}
          </span>
          <Suspense
            fallback={
              <span className="text-body-sm text-muted-foreground">לעמוד…</span>
            }
          >
            <ShadchanimPerPageSelect />
          </Suspense>
        </div>
      </div>
      <DataTable
        className="pt-2"
        caption="רשימת השדכנים"
        breakpoint="lg"
        columns={SHADCHAN_COLUMNS}
        rows={stats}
        getRowKey={(shadchan) => shadchan.id}
        mobileTitle={(shadchan) => <ShadchanName shadchan={shadchan} />}
      />

      <ShadchanimPagination page={page} lastPage={lastPage} perPage={perPage} />
    </>
  );
}
