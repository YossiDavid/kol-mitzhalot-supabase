"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  describeVisibleRange,
  getVisiblePaginationPages,
  pageCount,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

const DEFAULT_RANGE_TEST_ID = "list-range";
const DEFAULT_ARIA_LABEL = "עמודי הרשימה";

type ListPaginationProps = {
  /** מספר עמוד שמתחיל ב-1 */
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** כתובת אמיתית לכל עמוד (פתיחה בלשונית חדשה, מקלדת); ללא - "#" */
  hrefFor?: (page: number) => string;
  rangeTestId?: string;
  ariaLabel?: string;
};

type PageButtonProps = {
  page: number;
  href: string;
  ariaLabel?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  size?: "default" | "icon";
  className?: string;
  children: React.ReactNode;
  onSelect: (page: number) => void;
};

/**
 * קישור עמוד. href אמיתי כדי שיהיה נגיש במקלדת (Tab ו-Enter), והניווט
 * עצמו הוא קריאה חוזרת - לכן מבטלים את ברירת המחדל של הקישור.
 */
function PageButton({
  page,
  href,
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
      href={href}
      size={size}
      isActive={isActive}
      aria-label={ariaLabel}
      aria-disabled={isDisabled || undefined}
      tabIndex={isDisabled ? -1 : undefined}
      className={cn(isDisabled && "pointer-events-none opacity-50", className)}
      onClick={(event) => {
        // לחיצה עם מקש עזר (לשונית חדשה) נשארת לדפדפן
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        if (!isDisabled && !isActive) onSelect(page);
      }}
    >
      {children}
    </PaginationLink>
  );
}

/**
 * סיכום הטווח ("מציג 1–20 מתוך 45") ובקרת העמודים, משותפים לכל הרשימות
 * עם עימוד. בעמוד יחיד מוצג הסיכום בלבד.
 */
export function ListPagination({
  page,
  total,
  pageSize,
  onPageChange,
  hrefFor,
  rangeTestId = DEFAULT_RANGE_TEST_ID,
  ariaLabel = DEFAULT_ARIA_LABEL,
}: ListPaginationProps) {
  const lastPage = pageCount(total, pageSize);
  const visiblePages = getVisiblePaginationPages(page, lastPage);
  const hrefOf = (target: number) => hrefFor?.(target) ?? "#";

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <p
        className="text-body-sm text-muted-foreground"
        data-testid={rangeTestId}
        aria-live="polite"
      >
        {describeVisibleRange(page, total, pageSize)}
      </p>
      {lastPage > 1 && (
        <Pagination aria-label={ariaLabel} className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PageButton
                page={page - 1}
                href={hrefOf(Math.max(1, page - 1))}
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
                    href={hrefOf(item)}
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
                href={hrefOf(Math.min(lastPage, page + 1))}
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
