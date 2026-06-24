"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import {
  buildShadchanimHref,
  getVisiblePaginationPages,
  type AdminShadchanimQuery,
} from "@/features/admin/lib/shadchanim-query";
import { cn } from "@/lib/utils";

const PER_PAGE_OPTIONS = ["10", "25", "50", "100"] as const;

type ShadchanimPaginationProps = {
  page: number;
  lastPage: number;
  perPage: number;
};

function queryFromProps(page: number, perPage: number): AdminShadchanimQuery {
  return { page, perPage };
}

function useShadchanimNavigate() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (href: string) => {
    startTransition(() => {
      router.push(href as Route, { scroll: false });
    });
  };

  return { navigate, isPending };
}

function PaginationPageLink({
  href,
  isActive,
  size = "icon",
  className,
  children,
  ariaLabel,
  onNavigate,
}: {
  href: string;
  isActive?: boolean;
  size?: "default" | "icon";
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <PaginationLink
      href={href}
      isActive={isActive}
      size={size}
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </PaginationLink>
  );
}

export function ShadchanimPerPageSelect() {
  const searchParams = useSearchParams();
  const { navigate, isPending } = useShadchanimNavigate();
  const perPage = searchParams.get("perPage") ?? "25";

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="shadchan-perPage" className="text-muted-foreground text-sm">
        לעמוד
      </Label>
      <NativeSelect
        id="shadchan-perPage"
        className="w-20"
        value={perPage}
        disabled={isPending}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value === "25") params.delete("perPage");
          else params.set("perPage", e.target.value);
          params.delete("page");
          const qs = params.toString();
          navigate(qs ? `/app/admin/shadchanim?${qs}` : "/app/admin/shadchanim");
        }}
      >
        {PER_PAGE_OPTIONS.map((n) => (
          <NativeSelectOption key={n} value={n}>
            {n}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function NavLink({
  href,
  disabled,
  children,
  ariaLabel,
  onNavigate,
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
  ariaLabel: string;
  onNavigate: (href: string) => void;
}) {
  if (disabled) {
    return (
      <PaginationLink
        href="#"
        aria-label={ariaLabel}
        aria-disabled
        tabIndex={-1}
        size="default"
        className="pointer-events-none gap-1 px-2.5 opacity-50"
        onClick={(e) => e.preventDefault()}
      >
        {children}
      </PaginationLink>
    );
  }

  return (
    <PaginationPageLink
      href={href}
      size="default"
      className="gap-1 px-2.5"
      ariaLabel={ariaLabel}
      onNavigate={onNavigate}
    >
      {children}
    </PaginationPageLink>
  );
}

export function ShadchanimPagination({
  page,
  lastPage,
  perPage,
}: ShadchanimPaginationProps) {
  const { navigate, isPending } = useShadchanimNavigate();

  if (lastPage <= 1) return null;

  const query = queryFromProps(page, perPage);
  const visiblePages = getVisiblePaginationPages(page, lastPage);

  return (
    <Pagination
      className={cn(
        "w-auto justify-center pt-8 transition-opacity",
        isPending && "pointer-events-none opacity-60",
      )}
      aria-busy={isPending}
    >
      <PaginationContent>
        <PaginationItem>
          <NavLink
            href={buildShadchanimHref(query, { page: page - 1 })}
            disabled={page <= 1}
            ariaLabel="עמוד קודם"
            onNavigate={navigate}
          >
            <ChevronRight className="size-4" />
            <span>הקודם</span>
          </NavLink>
        </PaginationItem>

        {visiblePages.map((p, index) =>
          p === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationPageLink
                href={buildShadchanimHref(query, { page: p })}
                isActive={p === page}
                size="icon"
                onNavigate={navigate}
              >
                {p}
              </PaginationPageLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <NavLink
            href={buildShadchanimHref(query, { page: page + 1 })}
            disabled={page >= lastPage}
            ariaLabel="עמוד הבא"
            onNavigate={navigate}
          >
            <span>הבא</span>
            <ChevronLeft className="size-4" />
          </NavLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
