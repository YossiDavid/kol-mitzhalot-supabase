import {
  SHIDDUCH_STATUS_VALUES,
  type ShidduchStatus,
} from "@/features/shidduchim/lib/status";

/**
 * הפרמטרים של "כל ההצעות" (/app/admin/proposals), כמקור אמת אחד לדף,
 * לקישורים אליו ולטופס הסינון.
 */

export const PROPOSALS_REPORT_PATH = "/app/admin/proposals";
export const PROPOSALS_PAGE_SIZE = 25;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ProposalsReportQuery = {
  page: number;
  /** שם השדכן (חלק ממנו), או מזהה משתמש מדויק */
  shadchan: string;
  /** שם הכרטיס המקבל (חלק ממנו), או מזהה כרטיס מדויק */
  card: string;
  /** YYYY-MM-DD, כולל */
  from: string;
  /** YYYY-MM-DD, כולל */
  to: string;
  /** הסטטוס הנוכחי של ההצעה, "deleted" להצעות שנמחקו, או ריק = הכול */
  status: ProposalsStatusFilter;
};

/** ערך הסינון להצעות שנמחקו (אין להן שורת shidduchim) */
export const DELETED_STATUS_FILTER = "deleted";

export type ProposalsStatusFilter =
  | ""
  | ShidduchStatus
  | typeof DELETED_STATUS_FILTER;

function pickStatus(
  raw: Record<string, string | string[] | undefined>,
): ProposalsStatusFilter {
  const value = pick(raw, "status");
  if (value === DELETED_STATUS_FILTER) return value;
  return (SHIDDUCH_STATUS_VALUES as readonly string[]).includes(value)
    ? (value as ShidduchStatus)
    : "";
}

export const isUuid = (value: string) => UUID_PATTERN.test(value);

function pick(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function pickDate(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = pick(raw, key);
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : "";
}

export function parseProposalsReportQuery(
  raw: Record<string, string | string[] | undefined>,
): ProposalsReportQuery {
  const page = Math.max(1, parseInt(pick(raw, "page") || "1", 10) || 1);
  return {
    page,
    shadchan: pick(raw, "shadchan").slice(0, 100),
    card: pick(raw, "card").slice(0, 100),
    from: pickDate(raw, "from"),
    to: pickDate(raw, "to"),
    status: pickStatus(raw),
  };
}

/** קישור לדוח עם סינון (ללא ערכים ריקים) */
export function proposalsReportHref(
  query: Partial<ProposalsReportQuery>,
): string {
  const params = new URLSearchParams();
  if (query.page && query.page > 1) params.set("page", String(query.page));
  for (const key of ["shadchan", "card", "from", "to", "status"] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  const queryString = params.toString();
  return queryString
    ? `${PROPOSALS_REPORT_PATH}?${queryString}`
    : PROPOSALS_REPORT_PATH;
}
