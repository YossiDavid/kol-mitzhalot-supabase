import { DataTableView } from "./data-table-view";
import { hasSortableColumns } from "./sort-rows";
import { SortableDataTable } from "./sortable-data-table";
import type { DataTableProps } from "./types";

export { DATA_TABLE_BREAKPOINT_CLASS } from "./data-table-view";
export type {
  DataTableAlign,
  DataTableColumn,
  DataTableColumnSize,
  DataTableMobileSlot,
  DataTableProps,
  DataTableRowLink,
  DataTableSort,
  DataTableSortDirection,
  DataTableSortValue,
} from "./types";

/**
 * טבלת נתונים אחת לכל המערכת: טבלה סמנטית מ-md (או lg), וכרטיסים במובייל.
 * בלי עמודות ממוינות אינה רכיב לקוח - אפשר להציג אותה מעמוד שרת; רק
 * שורות-קישור רצות בלקוח. עמודה עם sortValue מעבירה את הטבלה לרכיב לקוח
 * (SortableDataTable), ולכן טבלה ממוינת מוצגת מתוך רכיב לקוח - פונקציות
 * sortValue ו-cell אינן עוברות מעמוד שרת.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  if (props.rows.length === 0) return <>{props.emptyState ?? null}</>;
  if (hasSortableColumns(props.columns)) {
    return <SortableDataTable {...props} />;
  }
  return <DataTableView {...props} />;
}
