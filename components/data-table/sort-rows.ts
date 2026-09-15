import type * as React from "react";

import type {
  DataTableColumn,
  DataTableSort,
  DataTableSortValue,
} from "./types";

const collator = new Intl.Collator("he", {
  numeric: true,
  sensitivity: "base",
});

export function isSortableColumn<T>(column: DataTableColumn<T>): boolean {
  return typeof column.sortValue === "function";
}

export function hasSortableColumns<T>(
  columns: readonly DataTableColumn<T>[],
): boolean {
  return columns.some(isSortableColumn);
}

/** שם העמודה בפקדי המיון: sortLabel, או הכותרת כשהיא טקסט */
export function columnSortLabel<T>(column: DataTableColumn<T>): string {
  if (column.sortLabel) return column.sortLabel;
  return typeof column.header === "string" ? column.header : column.key;
}

function isEmptySortValue(value: DataTableSortValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (value instanceof Date) return Number.isNaN(value.getTime());
  return Number.isNaN(value);
}

function toNumber(value: number | Date): number {
  return value instanceof Date ? value.getTime() : value;
}

/** השוואה בסדר עולה, לשני ערכים שאינם ריקים */
function compareFilledValues(
  a: NonNullable<DataTableSortValue>,
  b: NonNullable<DataTableSortValue>,
): number {
  if (typeof a !== "string" && typeof b !== "string") {
    return toNumber(a) - toNumber(b);
  }
  return collator.compare(String(a), String(b));
}

/**
 * שורות ממוינות בעותק חדש. המיון יציב (שורות שוות שומרות על סדרן), וערכים
 * ריקים תמיד בסוף - גם בסדר יורד. מיון שאינו תואם עמודה ממוינת - בלי שינוי.
 */
export function sortRows<T>(
  rows: readonly T[],
  columns: readonly DataTableColumn<T>[],
  sort: DataTableSort | null,
): readonly T[] {
  const column = sort
    ? columns.find((candidate) => candidate.key === sort.key)
    : undefined;
  const getValue = column?.sortValue;
  if (!sort || !getValue) return rows;

  const sign = sort.direction === "asc" ? 1 : -1;
  const entries = rows.map((row) => ({ row, value: getValue(row) }));
  const sorted = [...entries].sort((a, b) => {
    const isEmptyA = isEmptySortValue(a.value);
    const isEmptyB = isEmptySortValue(b.value);
    if (isEmptyA || isEmptyB) return Number(isEmptyA) - Number(isEmptyB);
    return (
      sign *
      compareFilledValues(
        a.value as NonNullable<DataTableSortValue>,
        b.value as NonNullable<DataTableSortValue>,
      )
    );
  });
  return sorted.map((entry) => entry.row);
}

/** לחיצה על כותרת: עולה, יורד, ובלחיצה השלישית חזרה לסדר המקורי */
export function nextHeaderSort(
  current: DataTableSort | null,
  key: string,
): DataTableSort | null {
  if (current?.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

export type AriaSort = React.AriaAttributes["aria-sort"];

export function ariaSortFor(sort: DataTableSort | null, key: string): AriaSort {
  if (sort?.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}
