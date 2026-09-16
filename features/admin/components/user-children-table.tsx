import type { Route } from "next";
import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import calculateAge from "@/lib/calculateAge";
import type {
  UserChildRow,
  UserDetails,
} from "@/features/admin/lib/user-details";

function childColumns(
  byChild: UserDetails["shidduchimStats"]["byChild"],
): DataTableColumn<UserChildRow>[] {
  const statsFor = (childId: string) =>
    byChild.find((s) => s.childId === childId) ?? { offered: 0, completed: 0 };

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
      key: "offered",
      header: "שידוכים הוצעו",
      size: "min",
      align: "center",
      cell: (child) => statsFor(child.id).offered,
    },
    {
      key: "completed",
      header: "שידוכים נסגרו",
      size: "min",
      align: "center",
      cell: (child) => statsFor(child.id).completed,
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
