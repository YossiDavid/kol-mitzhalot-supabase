"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { ListPagination } from "@/components/list-pagination";
import { PAGE_SEARCH_PARAM } from "@/lib/pagination";

type UrlPaginationProps = {
  page: number;
  total: number;
  pageSize: number;
  ariaLabel?: string;
};

/**
 * עימוד של רשימה שמוצגת בשרת: העמוד נשמר בפרמטר `?page=` ושאר הפרמטרים
 * (סינון, נושא) נשמרים כמות שהם. עמוד 1 מוציא את הפרמטר מהכתובת.
 */
export function UrlPagination({
  page,
  total,
  pageSize,
  ariaLabel,
}: UrlPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const hrefFor = useCallback(
    (target: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (target > 1) params.set(PAGE_SEARCH_PARAM, String(target));
      else params.delete(PAGE_SEARCH_PARAM);
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const goTo = useCallback(
    (target: number) => {
      startTransition(() => {
        router.push(hrefFor(target) as Route, { scroll: true });
      });
    },
    [router, hrefFor],
  );

  return (
    <div aria-busy={isPending} className={isPending ? "opacity-70" : undefined}>
      <ListPagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={goTo}
        hrefFor={hrefFor}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
