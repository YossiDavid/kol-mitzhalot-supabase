/** Client-safe helpers for the "פניה לשדכן" flow. Enforcement lives in the DB (contact_shadchan). */

import type { ContactQuota } from "./types";

/** Must match c_max_message_length in public.contact_shadchan. */
export const CONTACT_MESSAGE_MAX_LENGTH = 2000;

const CONTACT_ERROR_MESSAGES: Record<string, string> = {
  daily_contact_limit_reached:
    "הגעת למכסת הפניות היומית לשדכנים. ניתן יהיה לפנות לשדכנים נוספים מחר.",
  invalid_shadchan: "השדכן המבוקש לא נמצא.",
  message_required: "יש לכתוב הודעה לשדכן.",
  message_too_long: "ההודעה ארוכה מדי.",
  authentication_required: "יש להתחבר כדי לפנות לשדכן.",
};

const GENERIC_CONTACT_ERROR = "שליחת הפנייה נכשלה. נסו שוב בעוד רגע.";

function errorMessageOf(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return null;
  }
  return typeof error.message === "string" ? error.message : null;
}

/** Hebrew message for an error from contact_shadchan or from opening a chat room with a shadchan. */
export function contactErrorMessage(error: unknown): string {
  const message = errorMessageOf(error);
  return (message && CONTACT_ERROR_MESSAGES[message]) || GENERIC_CONTACT_ERROR;
}

export type ContactAvailability =
  | { kind: "exempt" }
  | { kind: "reply" }
  | { kind: "already_contacted" }
  | { kind: "available"; remaining: number; limit: number }
  | { kind: "limit_reached"; limit: number };

/**
 * Whether the current user may open a new contact with this shadchan today.
 * A shadchan already contacted today, or one who sent this parent a
 * proposal, does not consume another slot.
 */
export function getContactAvailability(
  quota: ContactQuota | null,
  shadchanId: string,
): ContactAvailability | null {
  if (!quota) return null;
  if (quota.isExempt) return { kind: "exempt" };
  if (quota.replyShadchanIds.includes(shadchanId)) return { kind: "reply" };
  if (quota.contactedShadchanIds.includes(shadchanId)) {
    return { kind: "already_contacted" };
  }
  if (quota.remainingToday <= 0) {
    return { kind: "limit_reached", limit: quota.dailyLimit };
  }
  return {
    kind: "available",
    remaining: quota.remainingToday,
    limit: quota.dailyLimit,
  };
}
