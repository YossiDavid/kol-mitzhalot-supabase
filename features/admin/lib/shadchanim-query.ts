/** Client-safe query helpers — no server imports. */

/** מיון רשימת השדכנים: הגשה אחרונה (ברירת מחדל), נראה לאחרונה, זמן פעילות */
export const SHADCHANIM_SORTS = ["submitted", "last_seen", "active_time"] as const;
export type AdminShadchanimSort = (typeof SHADCHANIM_SORTS)[number];

/**
 * authorized: שדכנים מורשים - בקשה מאושרת, תפקיד שדכן ולא מוקפאים.
 * others: כל השאר (ממתינים, נדחו, הוסרו, מוקפאים). all: הכל.
 */
export const SHADCHANIM_GROUPS = ["authorized", "others", "all"] as const;
export type AdminShadchanimGroup = (typeof SHADCHANIM_GROUPS)[number];

export const SHADCHANIM_GROUP_LABELS: Record<AdminShadchanimGroup, string> = {
  authorized: "שדכנים מורשים",
  others: "שאר (ממתינים, נדחו, מוקפאים)",
  all: "הכל",
};

export function parseShadchanimGroup(
  value: string | undefined | null,
): AdminShadchanimGroup {
  return (SHADCHANIM_GROUPS as readonly string[]).includes(value ?? "")
    ? (value as AdminShadchanimGroup)
    : "authorized";
}

export type AdminShadchanimQuery = {
  page: number;
  perPage: number;
  /** חיפוש חופשי בשם, אימייל או טלפון */
  q?: string;
  sort?: AdminShadchanimSort;
  group?: AdminShadchanimGroup;
};

export function parseShadchanimSort(
  value: string | undefined | null,
): AdminShadchanimSort {
  return isShadchanimSort(value) ? value : "submitted";
}

function isShadchanimSort(
  value: string | undefined | null,
): value is AdminShadchanimSort {
  return (SHADCHANIM_SORTS as readonly string[]).includes(value ?? "");
}

export function buildShadchanimHref(
  base: AdminShadchanimQuery,
  overrides: Partial<AdminShadchanimQuery> = {},
): string {
  const m = { ...base, ...overrides };
  const params = new URLSearchParams();
  if (m.q?.trim()) params.set("q", m.q.trim());
  if (m.sort && m.sort !== "submitted") params.set("sort", m.sort);
  if (m.group && m.group !== "authorized") params.set("group", m.group);
  if (m.page > 1) params.set("page", String(m.page));
  if (m.perPage !== 25) params.set("perPage", String(m.perPage));
  const qs = params.toString();
  return qs ? `/app/admin/shadchanim?${qs}` : "/app/admin/shadchanim";
}

export { getVisiblePaginationPages } from "@/lib/pagination";
