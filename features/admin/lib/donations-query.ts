/** פרמטרי עמוד התרומות לניהול (/app/admin/donations): דף וסינון לפי סטטוס */
import {
  isDonationStatus,
  type DonationStatus,
} from "@/features/donations/lib/status";

export const DONATIONS_PATH = "/app/admin/donations";
export const DONATIONS_PAGE_SIZE = 25;

export type DonationsQuery = {
  page: number;
  /** null = כל הסטטוסים */
  status: DonationStatus | null;
};

function pick(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseDonationsQuery(
  raw: Record<string, string | string[] | undefined>,
): DonationsQuery {
  const status = pick(raw, "status");
  return {
    page: Math.max(1, parseInt(pick(raw, "page") || "1", 10) || 1),
    status: isDonationStatus(status) ? status : null,
  };
}

export function donationsHref(query: Partial<DonationsQuery>): string {
  const params = new URLSearchParams();
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.status) params.set("status", query.status);
  const queryString = params.toString();
  return queryString ? `${DONATIONS_PATH}?${queryString}` : DONATIONS_PATH;
}
