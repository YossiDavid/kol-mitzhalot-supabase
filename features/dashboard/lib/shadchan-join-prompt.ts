import type { ApplicationStatus } from "@/lib/application-status";

/**
 * מה מציגים בדשבורד למי שנרשם כדי להצטרף כשדכן:
 * - complete: עדיין לא הגיש בקשה - כפתור לטופס ההצטרפות
 * - pending: הבקשה הוגשה וממתינה לאישור מנהל
 * - none: אין מה להציג (לא נרשם כשדכן, כבר שדכן, או שהבקשה נדחתה/אושרה)
 */
export type ShadchanJoinPrompt = "complete" | "pending" | "none";

const SHADCHAN_PURPOSE = "shadchan";

export function shadchanJoinPrompt({
  signupPurpose,
  isShadchanOrAdmin,
  applicationStatus,
}: {
  signupPurpose: string | null;
  isShadchanOrAdmin: boolean;
  /** סטטוס הבקשה ב-shadchanim_info; null = אין שורה (או שורה בלי סטטוס) */
  applicationStatus: ApplicationStatus | null;
}): ShadchanJoinPrompt {
  if (signupPurpose !== SHADCHAN_PURPOSE || isShadchanOrAdmin) return "none";
  if (applicationStatus === null) return "complete";
  return applicationStatus === "pending" ? "pending" : "none";
}
