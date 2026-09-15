"use client";

import { useState } from "react";

import { DataTableView } from "./data-table-view";
import { sortRows } from "./sort-rows";
import type { DataTableProps, DataTableSort } from "./types";

/**
 * DataTable עם עמודות ממוינות. רכיב לקוח נפרד, כדי שטבלה בלי מיון תישאר
 * רכיב שרת. המיון נשלט (sort + onSortChange) או פנימי (initialSort).
 */
export function SortableDataTable<T>(props: DataTableProps<T>) {
  const {
    columns,
    rows,
    initialSort = null,
    sort: controlledSort,
    onSortChange,
  } = props;
  const [uncontrolledSort, setUncontrolledSort] =
    useState<DataTableSort | null>(initialSort);
  const isControlled = controlledSort !== undefined;
  const sort = isControlled ? controlledSort : uncontrolledSort;

  const handleSortChange = (next: DataTableSort | null) => {
    if (!isControlled) setUncontrolledSort(next);
    onSortChange?.(next);
  };

  return (
    <DataTableView
      {...props}
      rows={sortRows(rows, columns, sort)}
      sorting={{ sort, onSortChange: handleSortChange }}
    />
  );
}
