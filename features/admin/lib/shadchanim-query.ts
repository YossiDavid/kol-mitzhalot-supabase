/** Client-safe query helpers — no server imports. */

export type AdminShadchanimQuery = {
  page: number;
  perPage: number;
};

export function buildShadchanimHref(
  base: AdminShadchanimQuery,
  overrides: Partial<AdminShadchanimQuery> = {},
): string {
  const m = { ...base, ...overrides };
  const params = new URLSearchParams();
  if (m.page > 1) params.set("page", String(m.page));
  if (m.perPage !== 25) params.set("perPage", String(m.perPage));
  const qs = params.toString();
  return qs ? `/app/admin/shadchanim?${qs}` : "/app/admin/shadchanim";
}

/** Page numbers with ellipsis for shadcn Pagination */
export function getVisiblePaginationPages(
  current: number,
  total: number,
  siblingCount = 1,
): (number | "ellipsis")[] {
  if (total <= 1) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - siblingCount);
  const end = Math.min(total - 1, current + siblingCount);

  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}
