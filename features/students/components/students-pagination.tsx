"use client";

import { ListPagination } from "@/components/list-pagination";
import { STUDENTS_PAGE_SIZE } from "@/features/students/lib/students-list-query";

type StudentsPaginationProps = {
  /** מספר עמוד שמתחיל ב-1 */
  page: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** העימוד של רשימת המיועדים: הרכיב המשותף עם גודל העמוד של הרשימה */
export function StudentsPagination({
  page,
  total,
  onPageChange,
}: StudentsPaginationProps) {
  return (
    <ListPagination
      page={page}
      total={total}
      pageSize={STUDENTS_PAGE_SIZE}
      onPageChange={onPageChange}
      rangeTestId="students-range"
    />
  );
}
