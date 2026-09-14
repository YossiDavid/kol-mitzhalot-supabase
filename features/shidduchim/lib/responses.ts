import type { ShidduchStatus } from "@/features/shidduchim/lib/status";

/**
 * תגובות הורים להצעת שידוך. הערכים והכללים כאן חייבים להישאר מסונכרנים
 * עם public.respond_to_shidduch
 * (supabase/migrations/20260910100000_shidduch_parent_responses.sql),
 * שהיא מקור האמת בפועל - כאן הם משמשים רק לתצוגה ולוולידציה מוקדמת.
 */

export const SHIDDUCH_SIDES = ["groom", "bride"] as const;
export type ShidduchSide = (typeof SHIDDUCH_SIDES)[number];

export const SHIDDUCH_RESPONSE_VALUES = [
  "interested",
  "more_info_needed",
  "rejected",
] as const;
export type ShidduchResponse = (typeof SHIDDUCH_RESPONSE_VALUES)[number];

/** תואם ל-CHECK על shidduch_responses.message */
export const RESPONSE_MESSAGE_MAX_LENGTH = 2000;

export const SHIDDUCH_RESPONSE_LABELS: Record<ShidduchResponse, string> = {
  interested: "מעוניינים",
  more_info_needed: "מבקשים מידע נוסף",
  rejected: "לא מעוניינים",
};

export const SHIDDUCH_RESPONSE_BADGE_CLASS: Record<ShidduchResponse, string> = {
  interested: "bg-emerald-100 text-emerald-800 border-emerald-200",
  more_info_needed: "bg-orange-100 text-orange-800 border-orange-200",
  rejected: "bg-rose-100 text-rose-800 border-rose-200",
};

export const SHIDDUCH_SIDE_LABELS: Record<ShidduchSide, string> = {
  groom: "צד המיועד",
  bride: "צד המיועדת",
};

/** סטטוסים שבהם ההצעה עדיין "פתוחה" מבחינת ההורה */
export const OPEN_SHIDDUCH_STATUSES: readonly ShidduchStatus[] = [
  "sent",
  "waiting_response",
  "interested",
  "more_info_needed",
  "in_progress",
];

export function isShidduchResponse(value: unknown): value is ShidduchResponse {
  return (
    typeof value === "string" &&
    (SHIDDUCH_RESPONSE_VALUES as readonly string[]).includes(value)
  );
}

export function isShidduchSide(value: unknown): value is ShidduchSide {
  return (
    typeof value === "string" &&
    (SHIDDUCH_SIDES as readonly string[]).includes(value)
  );
}

/**
 * מראה של כללי "מתי אסור להגיב" ב-respond_to_shidduch: שידוך שהושלם סגור,
 * ושידוך שנדחה פתוח לתגובה רק לצד שבעצמו דחה (כדי שיוכל לחזור בו).
 */
export function canRespondToProposal(
  status: ShidduchStatus,
  myResponse: ShidduchResponse | null,
): boolean {
  if (status === "draft" || status === "completed") return false;
  if (status === "rejected") return myResponse === "rejected";
  return true;
}

/** אזור הזמן קבוע כדי שרינדור בשרת (UTC) לא יזיז את השעה המוצגת */
const DISPLAY_TIME_ZONE = "Asia/Jerusalem";

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    timeZone: DISPLAY_TIME_ZONE,
  });
}

export function displayName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback: string,
): string {
  const full = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return full || fallback;
}
