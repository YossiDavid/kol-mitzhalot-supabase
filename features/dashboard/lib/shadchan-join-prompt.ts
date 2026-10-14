import type { ApplicationStatus } from "@/lib/application-status";

/**
 * מה מציגים בדשבורד למי שנרשם כדי להצטרף כשדכן או כאיש צוות:
 * - complete: עדיין לא הגיש בקשה - כפתור לטופס ההצטרפות
 * - pending: הבקשה הוגשה וממתינה לאישור מנהל
 * - none: אין מה להציג (לא נרשם למסלול, כבר בתפקיד, או שהבקשה נדחתה/אושרה)
 */
export type ShadchanJoinPrompt = "complete" | "pending" | "none";

/** מסלולי ההצטרפות שההרשמה יכולה לכוון אליהם */
export type JoinTrack = "shadchan" | "staff";

type JoinPromptInput = {
  signupPurpose: string | null;
  /** כבר מחזיק בתפקיד של המסלול (או מנהל) */
  hasTrackRoleOrAdmin: boolean;
  /** סטטוס הבקשה בטבלת המסלול; null = אין שורה (או שורה בלי סטטוס) */
  applicationStatus: ApplicationStatus | null;
};

/** ערך מטרת ההרשמה שמכוון לכל מסלול (זהה לערך ב-signup-purpose) */
const PURPOSE_BY_TRACK: Record<JoinTrack, string> = {
  shadchan: "shadchan",
  staff: "staff",
};

export function joinPrompt(
  track: JoinTrack,
  { signupPurpose, hasTrackRoleOrAdmin, applicationStatus }: JoinPromptInput,
): ShadchanJoinPrompt {
  if (signupPurpose !== PURPOSE_BY_TRACK[track] || hasTrackRoleOrAdmin) {
    return "none";
  }
  if (applicationStatus === null) return "complete";
  return applicationStatus === "pending" ? "pending" : "none";
}

export function shadchanJoinPrompt({
  signupPurpose,
  isShadchanOrAdmin,
  applicationStatus,
}: {
  signupPurpose: string | null;
  isShadchanOrAdmin: boolean;
  applicationStatus: ApplicationStatus | null;
}): ShadchanJoinPrompt {
  return joinPrompt("shadchan", {
    signupPurpose,
    hasTrackRoleOrAdmin: isShadchanOrAdmin,
    applicationStatus,
  });
}

export function staffJoinPrompt({
  signupPurpose,
  isStaffOrAdmin,
  applicationStatus,
}: {
  signupPurpose: string | null;
  isStaffOrAdmin: boolean;
  applicationStatus: ApplicationStatus | null;
}): ShadchanJoinPrompt {
  return joinPrompt("staff", {
    signupPurpose,
    hasTrackRoleOrAdmin: isStaffOrAdmin,
    applicationStatus,
  });
}
