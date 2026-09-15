import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { applicationStatusVariant } from "@/lib/application-status";
import { Spinner } from "@/components/ui/spinner";
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

function formatDate(dateString: string | null): string {
  if (!dateString) return "לא זמין";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
    key: "first-name",
    header: "שם פרטי",
    mobile: "hidden",
    cell: (shadchan) => shadchan.firstName || "לא זמין",
  },
  {
    key: "last-name",
    header: "שם משפחה",
    mobile: "hidden",
    cell: (shadchan) => shadchan.lastName || "לא זמין",
  },
  {
    key: "email",
    header: "אימייל",
    size: "grow",
    className: "wrap-anywhere",
    cell: (shadchan) => shadchan.email || "לא זמין",
  },
  {
    key: "joined",
    header: "תאריך הצטרפות",
    cell: (shadchan) => formatDate(shadchan.createdAt),
  },
  {
    key: "total",
    header: "שידוכים נוצרו",
    size: "min",
    align: "center",
    cell: (shadchan) => shadchan.totalShidduchim,
  },
  {
    key: "completed",
    header: "שידוכים נסגרו",
    size: "min",
    align: "center",
    cell: (shadchan) => shadchan.completedShidduchim,
  },
  {
    key: "last-created",
    header: "הצעה אחרונה",
    cell: (shadchan) => formatDate(shadchan.lastShidduchCreatedAt),
  },
  {
    key: "last-completed",
    header: "שידוך אחרון נסגר",
    cell: (shadchan) => formatDate(shadchan.lastShidduchCompletedAt),
  },
  {
    key: "last-sign-in",
    header: "התחברות אחרונה",
    cell: (shadchan) => formatDate(shadchan.lastSignInAt),
  },
];

export function ShadchanimListFallback() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-body-sm">
      <Spinner />
      טוען רשימת שדכנים…
    </div>
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
      <div className="py-10 text-center text-muted-foreground">
        לא נמצאו שדכנים במערכת
      </div>
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
        breakpoint="xl"
        columns={SHADCHAN_COLUMNS}
        rows={stats}
        getRowKey={(shadchan) => shadchan.id}
        mobileTitle={(shadchan) =>
          `${shadchan.firstName || "לא זמין"} ${shadchan.lastName || "לא זמין"}`
        }
      />

      <ShadchanimPagination page={page} lastPage={lastPage} perPage={perPage} />
    </>
  );
}
