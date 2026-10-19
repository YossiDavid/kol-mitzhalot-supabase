/** Client-safe types for the shadchan public card, activity and contact quota. */

import type { ShadchanGender } from "./gender";

export const SHADCHAN_ACTION_TYPES = [
  "proposal",
  "view",
  "photo_request",
  "message",
] as const;

export type ShadchanActionType = (typeof SHADCHAN_ACTION_TYPES)[number];

export const SHADCHAN_ACTION_LABELS: Record<ShadchanActionType, string> = {
  proposal: "הציע/ה שידוך",
  view: "צפה/תה בכרטיס",
  photo_request: "ביקש/ה לראות תמונה",
  message: "פנה/תה אליך בצ'אט",
};

/** The fields a shadchan shares publicly (from the join form), per card. */
export type ShadchanPublicCard = {
  id: string;
  name: string;
  avatarUrl: string | null;
  sinceYear: number | null;
  city: string | null;
  description: string | null;
  /** התמחויות (רק מה ש-list_approved_shadchanim כבר מחזירה); ריק כשאין */
  specializations: string[];
};

export type ShadchanActivity = ShadchanPublicCard & {
  lastActionAt: string;
  actionTypes: ShadchanActionType[];
};

/** phone/email מגיעים מה-DB רק לשדכן עצמו ולמנהל; לכל אחד אחר null. */
export type ShadchanFullProfile = ShadchanPublicCard & {
  /** null - לא מולא (שדכנים ותיקים) */
  gender: ShadchanGender | null;
  phone: string | null;
  email: string | null;
  experienceYears: number | null;
  closedMatches: number | null;
  languages: string[];
};

export type ContactQuota = {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  /** Shadchanim and admins are not limited. */
  isExempt: boolean;
  /** Shadchanim already contacted today — contacting them again is free. */
  contactedShadchanIds: string[];
  /** Shadchanim who sent this parent a proposal — replying to them is free. */
  replyShadchanIds: string[];
};

export function shadchanProfileHref(shadchanId: string) {
  return `/app/shadchanim/${shadchanId}`;
}
