"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { getVisiblePaginationPages } from "@/features/admin/lib/shadchanim-query";
import {
  pageCount,
  STUDENTS_PAGE_SIZE,
} from "@/features/students/lib/students-list-query";
import { cn } from "@/lib/utils";

type StudentsPaginationProps = {
  /** מספר עמוד שמתחיל ב-1 */
  page: number;
  total: number;
  onPageChange: (page: number) => void;
};

type PageButtonProps = {
  page: number;
  ariaLabel?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  size?: "default" | "icon";
  className?: string;
  children: React.ReactNode;
  onSelect: (page: number) => void;
};

/**
 * קישור עמוד. href אמיתי (#) כדי שיהיה נגיש במקלדת (Tab ו-Enter), והניווט
 * עצמו הוא מצב ברכיב - לכן מבטלים את ברירת המחדל של הקישור.
 */
function PageButton({
  page,
  ariaLabel,
  isActive,
  isDisabled,
  size = "icon",
  className,
  children,
  onSelect,
}: PageButtonProps) {
  return (
    <PaginationLink
      href="#"
      size={size}
      isActive={isActive}
      aria-label={ariaLabel}
      aria-disabled={isDisabled || undefined}
      tabIndex={isDisabled ? -1 : undefined}
      className={cn(isDisabled && "pointer-events-none opacity-50", className)}
      onClick={(event) => {
        event.preventDefault();
        if (!isDisabled && !isActive) onSelect(page);
      }}
    >
      {children}
    </PaginationLink>
  );
}

/** "מציג 1–50 מתוך 120" - ריק כשאין תוצאות */
export function describeVisibleRange(page: number, total: number): string {
  if (total === 0) return "";
  const first = (page - 1) * STUDENTS_PAGE_SIZE + 1;
  const last = Math.min(page * STUDENTS_PAGE_SIZE, total);
  return `מציג ${first}–${last} מתוך ${total}`;
}

/** סיכום הטווח ובקרת העמודים. בעמוד יחיד מוצג הסיכום בלבד */
export function StudentsPagination({
  page,
  total,
  onPageChange,
}: StudentsPaginationProps) {
  const lastPage = pageCount(total);
  const visiblePages = getVisiblePaginationPages(page, lastPage);

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <p
        className="text-body-sm text-muted-foreground"
        data-testid="students-range"
        aria-live="polite"
      >
        {describeVisibleRange(page, total)}
      </p>
      {lastPage > 1 && (
        <Pagination aria-label="עמודי הרשימה" className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PageButton
                page={page - 1}
                ariaLabel="עמוד קודם"
                isDisabled={page <= 1}
                size="default"
                className="gap-1 px-2.5"
                onSelect={onPageChange}
              >
                <ChevronRight className="size-4" />
                <span>הקודם</span>
              </PageButton>
            </PaginationItem>
            {visiblePages.map((item, index) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PageButton
                    page={item}
                    ariaLabel={`עמוד ${item}`}
                    isActive={item === page}
                    onSelect={onPageChange}
                  >
                    {item}
                  </PageButton>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PageButton
                page={page + 1}
                ariaLabel="עמוד הבא"
                isDisabled={page >= lastPage}
                size="default"
                className="gap-1 px-2.5"
                onSelect={onPageChange}
              >
                <span>הבא</span>
                <ChevronLeft className="size-4" />
              </PageButton>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
