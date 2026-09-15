import * as React from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  MobileSortControl,
  SortableHeaderButton,
} from "./data-table-sort-controls";
import { LinkedCard, LinkedTableRow } from "./row-link";
import { ariaSortFor, isSortableColumn } from "./sort-rows";
import type {
  DataTableAlign,
  DataTableColumn,
  DataTableColumnSize,
  DataTableMobileSlot,
  DataTableProps,
  DataTableSorting,
} from "./types";

/** מאיזה רוחב טבלה ומתחתיו כרטיסים - משותף לטבלה ולשלד הטעינה */
export const DATA_TABLE_BREAKPOINT_CLASS = {
  md: { table: "hidden md:block", cards: "md:hidden" },
  lg: { table: "hidden lg:block", cards: "lg:hidden" },
  xl: { table: "hidden xl:block", cards: "xl:hidden" },
} as const;

const SIZE_CLASS: Record<DataTableColumnSize, string> = {
  auto: "",
  min: "w-px whitespace-nowrap",
  grow: "min-w-40",
};

const ALIGN_CLASS: Record<DataTableAlign, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};

const ROW_CLASS = "hover:bg-muted/40";

const LINKED_CLASS =
  "cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset";

type DataTableViewProps<T> = DataTableProps<T> & {
  /** קיים רק כשהטבלה ממוינת (SortableDataTable) - אז הרינדור בלקוח */
  sorting?: DataTableSorting;
};

function columnClass<T>(column: DataTableColumn<T>) {
  return cn(
    SIZE_CLASS[column.size ?? "auto"],
    ALIGN_CLASS[column.align ?? "start"],
  );
}

function mobileSlot<T>(column: DataTableColumn<T>): DataTableMobileSlot {
  return column.mobile ?? "field";
}

function HeaderCell<T>({
  column,
  sorting,
}: {
  column: DataTableColumn<T>;
  sorting?: DataTableSorting;
}) {
  const isSortable = Boolean(sorting) && isSortableColumn(column);
  return (
    <TableHead
      scope="col"
      aria-sort={
        sorting && isSortable
          ? ariaSortFor(sorting.sort, column.key)
          : undefined
      }
      className={columnClass(column)}
    >
      {sorting && isSortable ? (
        <SortableHeaderButton column={column} sorting={sorting} />
      ) : (
        column.header
      )}
    </TableHead>
  );
}

function DesktopTable<T>({
  columns,
  rows,
  getRowKey,
  getRowLink,
  rowClassName,
  caption,
  sorting,
}: DataTableViewProps<T>) {
  return (
    <Table>
      {caption ? (
        <TableCaption className="sr-only">{caption}</TableCaption>
      ) : null}
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <HeaderCell key={column.key} column={column} sorting={sorting} />
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const link = getRowLink?.(row);
          const className = cn(
            ROW_CLASS,
            link && LINKED_CLASS,
            rowClassName?.(row),
          );
          const cells = columns.map((column) => (
            <TableCell
              key={column.key}
              className={cn(columnClass(column), column.className)}
            >
              {column.cell(row)}
            </TableCell>
          ));
          return link ? (
            <LinkedTableRow
              key={getRowKey(row)}
              href={link.href}
              label={link.label}
              className={className}
            >
              {cells}
            </LinkedTableRow>
          ) : (
            <TableRow key={getRowKey(row)} className={className}>
              {cells}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function MobileCardContent<T>({
  row,
  columns,
  mobileTitle,
}: {
  row: T;
  columns: readonly DataTableColumn<T>[];
  mobileTitle?: (row: T) => React.ReactNode;
}) {
  const bySlot = (slot: DataTableMobileSlot) =>
    columns.filter((column) => mobileSlot(column) === slot);
  const titleColumns = bySlot("title");
  const asideColumns = bySlot("aside");
  const fieldColumns = bySlot("field");
  const actionColumns = bySlot("actions");
  const hasHeader =
    Boolean(mobileTitle) || titleColumns.length > 0 || asideColumns.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 font-semibold break-words">
            {mobileTitle
              ? mobileTitle(row)
              : titleColumns.map((column) => (
                  <React.Fragment key={column.key}>
                    {column.cell(row)}
                  </React.Fragment>
                ))}
          </div>
          {asideColumns.length > 0 ? (
            <div className="flex shrink-0 items-center gap-1">
              {asideColumns.map((column) => (
                <React.Fragment key={column.key}>
                  {column.cell(row)}
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {fieldColumns.length > 0 ? (
        // זוגות תווית/ערך בשורה אחת שנשברת לפי הצורך - כרטיס קומפקטי
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
          {fieldColumns.map((column) => {
            const value = column.cell(row);
            // בכרטיס אין עמודה שמחזיקה מקום - שדה ריק לא מוצג בכלל
            if (value === null || value === undefined || value === "") {
              return null;
            }
            return (
              <div
                key={column.key}
                className="flex min-w-0 items-center gap-1.5"
              >
                <dt className="shrink-0 text-muted-foreground">
                  {column.mobileLabel ?? column.header}:
                </dt>
                <dd className={cn("min-w-0 break-words", column.className)}>
                  {value}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      {actionColumns.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {actionColumns.map((column) => (
            <React.Fragment key={column.key}>{column.cell(row)}</React.Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileCards<T>({
  columns,
  rows,
  getRowKey,
  getRowLink,
  rowClassName,
  mobileTitle,
  caption,
  surface,
}: DataTableViewProps<T>) {
  return (
    <ul aria-label={caption} className="flex flex-col gap-3">
      {rows.map((row) => {
        const link = getRowLink?.(row);
        const className = cn(
          "p-4",
          surface ? "box" : "rounded-lg border",
          link && cn(LINKED_CLASS, "transition-colors hover:bg-accent"),
          rowClassName?.(row),
        );
        const content = (
          <MobileCardContent
            row={row}
            columns={columns}
            mobileTitle={mobileTitle}
          />
        );
        return (
          <li key={getRowKey(row)}>
            {link ? (
              <LinkedCard
                href={link.href}
                label={link.label}
                className={className}
              >
                {content}
              </LinkedCard>
            ) : (
              <div className={className}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * הפריסה של DataTable: טבלה מה-breakpoint וכרטיסים מתחתיו. אינה רכיב
 * לקוח; כשמגיע sorting (רק מ-SortableDataTable) נוספים פקדי המיון.
 */
export function DataTableView<T>(props: DataTableViewProps<T>) {
  const {
    columns,
    breakpoint = "md",
    surface = true,
    className,
    sorting,
  } = props;
  const visibility = DATA_TABLE_BREAKPOINT_CLASS[breakpoint];
  return (
    <div data-slot="data-table" className={className}>
      <div className={cn(visibility.table, surface && "box px-2 py-1")}>
        <DesktopTable {...props} />
      </div>
      <div className={visibility.cards}>
        {sorting ? (
          <MobileSortControl columns={columns} sorting={sorting} />
        ) : null}
        <MobileCards {...props} surface={surface} />
      </div>
    </div>
  );
}
