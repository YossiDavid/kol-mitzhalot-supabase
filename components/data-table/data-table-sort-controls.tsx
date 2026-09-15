"use client";

import { useId, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { columnSortLabel, isSortableColumn, nextHeaderSort } from "./sort-rows";
import type {
  DataTableColumn,
  DataTableSortDirection,
  DataTableSorting,
} from "./types";

const NO_SORT_VALUE = "";

const DIRECTION_LABEL: Record<DataTableSortDirection, string> = {
  asc: "סדר עולה",
  desc: "סדר יורד",
};

function SortIcon({
  direction,
  className,
}: {
  direction: DataTableSortDirection | null;
  className?: string;
}) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown;
  return (
    <Icon
      aria-hidden
      className={cn("size-3.5 shrink-0", !direction && "opacity-50", className)}
    />
  );
}

/**
 * כותרת עמודה ממוינת בדסקטופ: כפתור בתוך ה-th (שנושא את aria-sort).
 * עולה, יורד, ובלחיצה השלישית חזרה לסדר המקורי.
 */
export function SortableHeaderButton<T>({
  column,
  sorting,
}: {
  column: DataTableColumn<T>;
  sorting: DataTableSorting;
}) {
  const direction =
    sorting.sort?.key === column.key ? sorting.sort.direction : null;
  return (
    <button
      type="button"
      aria-label={`מיון לפי ${columnSortLabel(column)}`}
      onClick={() =>
        sorting.onSortChange(nextHeaderSort(sorting.sort, column.key))
      }
      className={cn(
        "-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 font-medium transition-colors outline-none",
        "hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
        direction && "text-foreground",
      )}
    >
      {column.header}
      <SortIcon direction={direction} />
    </button>
  );
}

/** פקד המיון מעל כרטיסי המובייל - אותו מצב כמו כותרות הטבלה */
export function MobileSortControl<T>({
  columns,
  sorting,
}: {
  columns: readonly DataTableColumn<T>[];
  sorting: DataTableSorting;
}): ReactNode {
  const selectId = useId();
  const { sort, onSortChange } = sorting;
  const sortableColumns = columns.filter(isSortableColumn);

  const handleColumnChange = (key: string) => {
    if (key === NO_SORT_VALUE) {
      onSortChange(null);
      return;
    }
    onSortChange({ key, direction: sort?.direction ?? "asc" });
  };

  const toggleDirection = () => {
    if (!sort) return;
    onSortChange({
      key: sort.key,
      direction: sort.direction === "asc" ? "desc" : "asc",
    });
  };

  return (
    <div data-slot="data-table-sort" className="mb-3 flex items-center gap-2">
      <Label htmlFor={selectId} className="shrink-0 text-muted-foreground">
        מיון לפי
      </Label>
      <div className="min-w-0 flex-1">
        <NativeSelect
          id={selectId}
          size="sm"
          value={sort?.key ?? NO_SORT_VALUE}
          onChange={(event) => handleColumnChange(event.target.value)}
        >
          <NativeSelectOption value={NO_SORT_VALUE}>
            ללא מיון
          </NativeSelectOption>
          {sortableColumns.map((column) => (
            <NativeSelectOption key={column.key} value={column.key}>
              {columnSortLabel(column)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!sort}
        onClick={toggleDirection}
        aria-label={`כיוון המיון: ${DIRECTION_LABEL[sort?.direction ?? "asc"]}`}
      >
        <SortIcon direction={sort?.direction ?? "asc"} />
        {DIRECTION_LABEL[sort?.direction ?? "asc"]}
      </Button>
    </div>
  );
}
