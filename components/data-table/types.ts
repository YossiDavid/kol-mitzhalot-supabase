import type { Route } from "next";
import type * as React from "react";

/**
 * רוחב עמודה בדסקטופ. auto - לפי הדפדפן; min - צמודה לתוכן ובלי שבירת
 * שורה (מספרים, תאריכים, תגים, פעולות); grow - מקבלת את המקום שנשאר,
 * עם רוחב מינימלי כדי שטקסט לא יישבר מילה-מילה.
 */
export type DataTableColumnSize = "auto" | "min" | "grow";

export type DataTableAlign = "start" | "center" | "end";

/**
 * מקום העמודה בכרטיס המובייל: title - כותרת הכרטיס; aside - לצד הכותרת
 * (כוכב, תג, תיבת סימון); field - זוג תווית/ערך (ברירת מחדל); actions -
 * שורת הפעולות בתחתית; hidden - לא מוצגת במובייל.
 */
export type DataTableMobileSlot =
  | "title"
  | "aside"
  | "field"
  | "actions"
  | "hidden";

/** ערך מיון: טקסט לפי סדר עברי, מספר ותאריך לפי ערכם. ריק - תמיד בסוף */
export type DataTableSortValue = string | number | Date | null | undefined;

export type DataTableSortDirection = "asc" | "desc";

export interface DataTableSort {
  /** ה-key של העמודה */
  key: string;
  direction: DataTableSortDirection;
}

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  size?: DataTableColumnSize;
  align?: DataTableAlign;
  /** מחלקות לתא בדסקטופ ולערך בכרטיס המובייל (למשל break-all לאימייל) */
  className?: string;
  mobile?: DataTableMobileSlot;
  /** תווית בכרטיס המובייל, כשכותרת העמודה אינה מתאימה */
  mobileLabel?: React.ReactNode;
  /**
   * הופך את העמודה לממוינת. הערך צריך לעלות יחד עם מה שהמשתמש רואה -
   * "סדר עולה" בעמודת גיל הוא מהצעיר למבוגר.
   */
  sortValue?: (row: T) => DataTableSortValue;
  /** שם העמודה בפקדי המיון, כשהכותרת אינה טקסט */
  sortLabel?: string;
}

export interface DataTableRowLink {
  href: Route;
  /** שם נגיש לשורה - גם הטבלה וגם הכרטיס מקבלים אותו */
  label: string;
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  /** שורה שכולה קישור: לחיצה, Enter, ו-Cmd/Ctrl ללשונית חדשה */
  getRowLink?: (row: T) => DataTableRowLink | undefined;
  rowClassName?: (row: T) => string | false | undefined;
  /** כותרת כרטיס מובייל מותאמת, במקום עמודות ה-title */
  mobileTitle?: (row: T) => React.ReactNode;
  /** מוצג במקום הטבלה כשאין שורות */
  emptyState?: React.ReactNode;
  /** תיאור לקוראי מסך */
  caption?: string;
  /**
   * מאיזה רוחב מוצגת טבלה. lg לטבלאות רחבות, xl לטבלאות עם 10 עמודות ומעלה
   * (בטאבלט עם סרגל הצד הן גולשות)
   */
  breakpoint?: "md" | "lg" | "xl";
  /**
   * משטח כרטיס סביב הטבלה ולכל כרטיס מובייל. false כשהטבלה כבר יושבת
   * בתוך Box - אז כרטיסי המובייל מקבלים מסגרת במקום רקע.
   */
  surface?: boolean;
  className?: string;
  /** מיון התחלתי כשהמיון אינו נשלט מבחוץ. ברירת מחדל: סדר השורות כפי שהגיעו */
  initialSort?: DataTableSort | null;
  /** מיון נשלט - למשל כדי שישרוד טעינה מחדש של השורות */
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
}

/** מצב המיון שהטבלה מציגה ומעדכנת - קיים רק כשיש עמודות ממוינות */
export interface DataTableSorting {
  sort: DataTableSort | null;
  onSortChange: (sort: DataTableSort | null) => void;
}
