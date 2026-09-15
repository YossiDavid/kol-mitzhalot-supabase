import type { BadgeVariant } from "@/components/ui/badge";

export const SHIDDUCH_STATUS_VALUES = [
  "draft",
  "sent",
  "waiting_response",
  "interested",
  "more_info_needed",
  "in_progress",
  "rejected",
  "completed",
] as const;

export type ShidduchStatus = (typeof SHIDDUCH_STATUS_VALUES)[number];

export const SHIDDUCH_STATUS_LABELS: Record<ShidduchStatus, string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  waiting_response: "ממתינים לתגובה",
  interested: "מתעניינים",
  more_info_needed: "נדרש מידע נוסף",
  in_progress: "בתהליך",
  rejected: "לא רלוונטי",
  completed: "הושלם",
};

/**
 * גוון התג של כל סטטוס - המקום היחיד שקובע צבע לסטטוס שידוך.
 * לטוקנים אין גוונים נפרדים לסגול ולכתום, ולכן sent/in_progress חולקים
 * info, waiting_response/more_info_needed חולקים warning ו-interested/completed
 * חולקים success. התווית היא שמבדילה ביניהם.
 */
export const SHIDDUCH_STATUS_BADGE_VARIANT: Record<
  ShidduchStatus,
  BadgeVariant
> = {
  draft: "neutral",
  sent: "info",
  waiting_response: "warning",
  interested: "success",
  more_info_needed: "warning",
  in_progress: "info",
  rejected: "danger",
  completed: "success",
};

export const SHIDDUCH_STATUS_OPTIONS = SHIDDUCH_STATUS_VALUES.map((value) => ({
  value,
  label: SHIDDUCH_STATUS_LABELS[value],
}));

export function isShidduchStatus(value: string): value is ShidduchStatus {
  return (SHIDDUCH_STATUS_VALUES as readonly string[]).includes(value);
}
