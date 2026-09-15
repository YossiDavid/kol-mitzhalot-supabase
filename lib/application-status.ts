import type { BadgeVariant } from "@/components/ui/badge";

/**
 * סטטוס בקשת הצטרפות (שדכן או איש צוות) - אותו enum בשתי הטבלאות
 * (shadchanim_info, staff_info). null = אין בקשה.
 */
export type ApplicationStatus = "pending" | "approved" | "rejected";

/** נוסח הסטטוס כפי שהמבקש רואה אותו בעמוד ההגדרות */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
};

/** מיפוי אחד מסטטוס בקשה לגוון תג, לכל המסכים שמציגים בקשות הצטרפות */
export const APPLICATION_STATUS_BADGE_VARIANT: Record<
  ApplicationStatus,
  BadgeVariant
> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

/** גוון לסטטוס שעשוי להיות חסר (שדכן בלי בקשה) */
export function applicationStatusVariant(
  status: ApplicationStatus | null | undefined,
): BadgeVariant {
  return status ? APPLICATION_STATUS_BADGE_VARIANT[status] : "neutral";
}
