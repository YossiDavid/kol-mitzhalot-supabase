/**
 * הפרמטרים של יומן הפעילות (/app/admin/activity): מקור אמת אחד לדף, לקישורים
 * אליו ולטופס הסינון.
 */

export const ACTIVITY_LOG_PATH = "/app/admin/activity";
export const ACTIVITY_PAGE_SIZE = 50;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ACTIVITY_ENTITY_TYPES = [
  "student",
  "shidduch",
  "shadchan_application",
  "user",
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_ENTITY_LABELS: Record<ActivityEntityType, string> = {
  student: "כרטיסים",
  shidduch: "הצעות",
  shadchan_application: "בקשות שדכן",
  user: "משתמשים ותפקידים",
};

export type ActivityLogQuery = {
  page: number;
  /** ריק = כל הסוגים */
  entity: "" | ActivityEntityType;
  /** שם או אימייל של המבצע (חלק), או מזהה משתמש מדויק */
  actor: string;
  /** YYYY-MM-DD, כולל */
  from: string;
  /** YYYY-MM-DD, כולל */
  to: string;
};

export const isUuid = (value: string) => UUID_PATTERN.test(value);

type RawParams = Record<string, string | string[] | undefined>;

function pick(raw: RawParams, key: string): string {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function pickDate(raw: RawParams, key: string): string {
  const value = pick(raw, key);
  return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))
    ? value
    : "";
}

function pickEntity(raw: RawParams): ActivityLogQuery["entity"] {
  const value = pick(raw, "entity");
  return (ACTIVITY_ENTITY_TYPES as readonly string[]).includes(value)
    ? (value as ActivityEntityType)
    : "";
}

export function parseActivityLogQuery(raw: RawParams): ActivityLogQuery {
  return {
    page: Math.max(1, parseInt(pick(raw, "page") || "1", 10) || 1),
    entity: pickEntity(raw),
    actor: pick(raw, "actor").slice(0, 100),
    from: pickDate(raw, "from"),
    to: pickDate(raw, "to"),
  };
}

/** קישור ליומן עם סינון (ללא ערכים ריקים) */
export function activityLogHref(query: Partial<ActivityLogQuery>): string {
  const params = new URLSearchParams();
  if (query.page && query.page > 1) params.set("page", String(query.page));
  for (const key of ["entity", "actor", "from", "to"] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  const queryString = params.toString();
  return queryString ? `${ACTIVITY_LOG_PATH}?${queryString}` : ACTIVITY_LOG_PATH;
}
