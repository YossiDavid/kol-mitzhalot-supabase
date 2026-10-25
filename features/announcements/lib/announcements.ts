import { z } from "zod";

/**
 * הודעות מערכת (system_announcements): באנר בכניסה לאפליקציה עד "קראתי".
 * client-safe - בלי ייבוא של שרת.
 */

export const ANNOUNCEMENT_AUDIENCES = ["all", "shadchanim", "users"] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  all: "כל המשתמשים",
  shadchanim: "שדכנים",
  users: "משתמשים (לא שדכנים)",
};

export const SYSTEM_ANNOUNCEMENT_TITLE_MAX = 200;
export const SYSTEM_ANNOUNCEMENT_BODY_MAX = 2000;

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(SYSTEM_ANNOUNCEMENT_TITLE_MAX),
  body: z.string().trim().min(1).max(SYSTEM_ANNOUNCEMENT_BODY_MAX),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES),
  /** לשדכנים בלבד: גם התראה בפעמון ומייל (כמו "הודעה לכל השדכנים") */
  notifyShadchanim: z.boolean().default(false),
});

export const updateAnnouncementSchema = z.object({
  id: z.guid(),
  isActive: z.boolean(),
});

export type SystemAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  createdBy: string | null;
  createdAt: string;
};
