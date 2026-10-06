import type { DataTableSort } from "@/components/data-table";

/** מפתח עמודת הטבלה -> איך ממיינים אותה בשאילתה */
type SortSpec = {
  /** עמודה, או נתיב JSON של PostgREST (parents_info->father->self->>name) */
  column: string;
  /** ערכים ריקים תמיד בסוף, גם בסדר יורד. עמודות NOT NULL לא צריכות את זה */
  isNullable: boolean;
  /** סדר עולה בטבלה הוא סדר יורד בעמודה (גיל: מבוגר = תאריך לידה מוקדם) */
  isReversed?: boolean;
};

const FATHER_NAME_PATH = "parents_info->father->self->>name";
const MOTHER_NAME_PATH = "parents_info->mother->self->>name";

/**
 * המיון של רשימת המיועדים בשרת. המפתחות הם ה-key של עמודות
 * StudentsTable, והסמנטיקה זהה למיון שהיה בלקוח:
 * - גיל: "עולה" הוא מהצעיר למבוגר, כלומר birth_date בסדר יורד.
 * - שם האב והאם: לפי השם עצמו (בלי תואר), מתוך parents_info.
 * - סטטוס: לפי סדר ה-enum (רווק, גרוש, אלמן, מאורס, נשוי) ולא לפי
 *   התווית העברית - אין דרך למיין לפי תווית מחושבת בלי עמודה/פונקציה.
 */
const SORT_SPECS: Readonly<Record<string, SortSpec>> = {
  status: { column: "personal_status", isNullable: false },
  "last-name": { column: "last_name", isNullable: false },
  "first-name": { column: "first_name", isNullable: false },
  father: { column: FATHER_NAME_PATH, isNullable: true },
  mother: { column: MOTHER_NAME_PATH, isNullable: true },
  city: { column: "city", isNullable: false },
  community: { column: "community", isNullable: true },
  age: { column: "birth_date", isNullable: false, isReversed: true },
  height: { column: "height", isNullable: true },
};

/** ללא בחירה (או אחרי הלחיצה השלישית על כותרת): א-ב לפי שם משפחה */
export const DEFAULT_STUDENTS_SORT: DataTableSort = {
  key: "last-name",
  direction: "asc",
};

export type StudentsOrderTerm = {
  column: string;
  ascending: boolean;
  /** false = ריקים בסוף. undefined = ברירת המחדל של Postgres */
  nullsFirst?: false;
};

/**
 * רצף ה-order של השאילתה למיון נתון: העמודה, ואז id כשובר שוויון קבוע
 * כדי שעמודים לא יתערבבו כשיש ערכים זהים.
 */
export function buildStudentsOrder(
  sort: DataTableSort | null,
): StudentsOrderTerm[] {
  const requested = sort && SORT_SPECS[sort.key] ? sort : null;
  const effective = requested ?? DEFAULT_STUDENTS_SORT;
  const spec = SORT_SPECS[effective.key];
  const isAscending = (effective.direction === "asc") !== !!spec.isReversed;
  return [
    {
      column: spec.column,
      ascending: isAscending,
      ...(spec.isNullable ? { nullsFirst: false as const } : {}),
    },
    { column: "id", ascending: true },
  ];
}
