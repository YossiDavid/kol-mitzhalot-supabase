"use client";

import {
  hasActiveFilters,
  useStudentQuery,
} from "@/features/students/lib/student-query-context";
import { useStudentPoolTotal } from "@/features/students/lib/use-student-pool-total";

function formatCount(value: number): string {
  return value.toLocaleString("he-IL");
}

function cardsLabel(total: number): string {
  return total === 1 ? "כרטיס אחד" : `${formatCount(total)} כרטיסים`;
}

/**
 * מספר הכרטיסים ליד הכותרת: כמה תואמים לסינון הנוכחי (הסכום שהרשימה כבר
 * חישבה), וכשיש סינון - גם "מתוך N במאגר". בטעינה שלד, ובשגיאה לא מוצג מספר
 * (לא 0 שגוי): הרשימה עצמה מציגה את השגיאה.
 */
export function StudentsCountSummary() {
  const { query, listCount } = useStudentQuery();
  const isFiltered = hasActiveFilters(query);
  const pool = useStudentPoolTotal(isFiltered);

  if (listCount.status === "error") return null;
  if (listCount.status === "loading") {
    return (
      // span ולא Skeleton (div): התיאור של PageHeader הוא <p>, ו-div בתוכו שובר הידרציה
      <span
        role="status"
        aria-label="טוען את מספר הכרטיסים"
        data-testid="students-count-loading"
        className="inline-block h-5 w-40 animate-pulse rounded-md bg-primary-muted align-middle"
      />
    );
  }

  const poolText =
    isFiltered && pool.status === "ready"
      ? ` · מתוך ${formatCount(pool.total)} במאגר`
      : "";

  return (
    <span aria-live="polite" data-testid="students-count">
      <strong
        data-testid="students-count-total"
        data-total={listCount.total}
        className="font-bold text-foreground tabular-nums"
      >
        {cardsLabel(listCount.total)}
      </strong>
      {isFiltered ? " תואמים לסינון" : " במאגר"}
      <span data-testid="students-count-pool">{poolText}</span>
    </span>
  );
}
