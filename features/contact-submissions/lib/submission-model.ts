/**
 * מודל הפניות מהאתר (contact_submissions) והתשובות להן
 * (contact_submission_replies). משותף לדף הניהול (לקוח) ול-route המענה (שרת).
 */
import { z } from "zod";

export type SubmissionStatus = "new" | "read" | "replied" | "archived";
export type SubmissionType = "contact" | "shidduch_idea";

export type Submission = {
  id: string;
  type: SubmissionType;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string | null;
  payload: Record<string, unknown>;
  status: SubmissionStatus;
  created_at: string;
};

export type SubmissionReply = {
  id: string;
  submission_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  sent_to: string;
  email_sent: boolean;
  created_at: string;
};

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  new: "חדש",
  read: "נקרא",
  replied: "נענה",
  archived: "ארכיון",
};

export const TYPE_LABEL: Record<SubmissionType, string> = {
  contact: "פנייה כללית",
  shidduch_idea: "רעיון לשידוך",
};

export type SubmissionFilter = "all" | SubmissionStatus;

/** לשוניות הסינון בדף הפניות, לפי הסדר */
export const FILTER_TABS: readonly { key: SubmissionFilter; label: string }[] =
  [
    { key: "all", label: "הכל" },
    { key: "new", label: "חדש" },
    { key: "read", label: "נקרא" },
    { key: "replied", label: "נענו" },
    { key: "archived", label: "בארכיון" },
  ];

/** תואם ל-CHECK על contact_submission_replies.body */
export const REPLY_MAX_LENGTH = 5000;

export const replyBodySchema = z.object({
  body: z.string().trim().min(1).max(REPLY_MAX_LENGTH),
});

/** תשובת ה-route: התשובה נשמרה; emailSent=false עם skipped = סביבת פיתוח */
export type ReplyRouteResponse = {
  reply: SubmissionReply;
  emailSent: boolean;
  skipped: boolean;
  /** הודעת כשל מסירה (כשהמייל לא יצא בפרודקשן) */
  emailError: string | null;
};
