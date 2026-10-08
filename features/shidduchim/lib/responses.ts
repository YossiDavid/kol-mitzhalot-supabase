import type { BadgeVariant } from "@/components/ui/badge";
import type { ShidduchStatus } from "@/features/shidduchim/lib/status";
import { ISRAEL_TIME_ZONE } from "@/lib/time-zone";

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

/** גוון התג לכל תגובה - באותה משמעות כמו הסטטוסים המקבילים ב-status.ts */
export const SHIDDUCH_RESPONSE_BADGE_VARIANT: Record<
  ShidduchResponse,
  BadgeVariant
> = {
  interested: "success",
  more_info_needed: "warning",
  rejected: "danger",
};

export const SHIDDUCH_SIDE_LABELS: Record<ShidduchSide, string> = {
  groom: "צד המיועד",
  bride: "צד המיועדת",
};

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

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: ISRAEL_TIME_ZONE,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    timeZone: ISRAEL_TIME_ZONE,
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
