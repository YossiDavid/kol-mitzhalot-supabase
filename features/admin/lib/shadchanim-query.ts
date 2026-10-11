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

export { getVisiblePaginationPages } from "@/lib/pagination";
