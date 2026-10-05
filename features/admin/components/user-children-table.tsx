import type { Route } from "next";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import calculateAge from "@/lib/calculateAge";
import { AdminPauseButton } from "@/features/admin/components/admin-pause-button";
import { proposalsReportHref } from "@/features/admin/lib/proposals-report-query";
import type {
  UserChildRow,
  UserDetails,
} from "@/features/admin/lib/user-details";

function childColumns(
  byChild: UserDetails["shidduchimStats"]["byChild"],
): DataTableColumn<UserChildRow>[] {
  const statsFor = (childId: string) =>
    byChild.find((s) => s.childId === childId) ?? { received: 0, completed: 0 };

  return [
    {
      key: "name",
      header: "שם",
      size: "grow",
      mobile: "title",
      cell: (child) => (
        <Link
          href={`/app/students/${child.id}` as Route}
          className="text-primary hover:underline"
        >
          {child.firstName} {child.lastName}
        </Link>
      ),
    },
    {
      key: "gender",
      header: "מגדר",
      size: "min",
      cell: (child) => (child.gender === "male" ? "זכר" : "נקבה"),
    },
    {
      key: "age",
      header: "גיל",
      size: "min",
      cell: (child) => calculateAge(new Date(child.birthDate)),
    },
    { key: "city", header: "עיר", cell: (child) => child.city },
    {
      key: "received",
      header: "הצעות שהתקבלו",
      size: "min",
      align: "center",
      // מקושר לדוח ההצעות מסונן לכרטיס הזה
      cell: (child) => (
        <Link
          href={proposalsReportHref({ card: child.id }) as Route}
          className="text-primary hover:underline"
          data-testid={`received-count-${child.id}`}
        >
          {statsFor(child.id).received}
        </Link>
      ),
    },
    {
      key: "completed",
      header: "שידוכים נסגרו",
      size: "min",
      align: "center",
      cell: (child) => statsFor(child.id).completed,
    },
    {
      key: "pause",
      header: "השהיה",
      size: "min",
      cell: (child) => (
        <div className="flex flex-col items-start gap-1">
          {child.isAdminPaused && (
            <span
              className="text-caption text-warning-muted-foreground"
              data-testid={`admin-paused-badge-${child.id}`}
            >
              מושהה על ידי הנהלה
            </span>
          )}
          <AdminPauseButton
            studentId={child.id}
            studentName={`${child.firstName} ${child.lastName}`}
            isPaused={child.isAdminPaused}
          />
        </div>
      ),
    },
  ];
}

/** טבלת הילדים בעמוד פרטי המשתמש (ניהול) */
export function UserChildrenTable({
  rows,
  byChild,
}: {
  rows: UserChildRow[];
  byChild: UserDetails["shidduchimStats"]["byChild"];
}) {
  return (
    <DataTable
      surface={false}
      caption="ילדים במערכת"
      columns={childColumns(byChild)}
      rows={rows}
      getRowKey={(child) => child.id}
      emptyState={
        <Empty size="compact" surface={false}>
          <EmptyHeader>
            <EmptyTitle>אין ילדים רשומים במערכת</EmptyTitle>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}
