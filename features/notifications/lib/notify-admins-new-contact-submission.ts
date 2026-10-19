import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendEmail,
  type SendEmailParams,
  type SendEmailResult,
} from "@/lib/email/send-email";
import {
  buildAdminNewContactSubmissionEmail,
  type NewContactSubmissionParams,
} from "@/lib/email/templates/admin-new-contact-submission";

const TAG = "[admin-new-contact-submission-email]";

/** תלויות חיצוניות - ניתנות להחלפה בבדיקות (בלי מסד ובלי SendGrid) */
export type NotifySubmissionDeps = {
  loadAdminEmails: () => Promise<string[]>;
  send: (params: SendEmailParams) => Promise<SendEmailResult>;
};

export async function loadAdminEmailsFromDb(): Promise<string[]> {
  const { data, error } = await createAdminClient().rpc("get_admin_emails");
  if (error) throw new Error(`שליפת מיילי המנהלים נכשלה: ${error.message}`);
  const emails = ((data ?? []) as { email: string | null }[])
    .map((row) => row.email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email));
  // מנהל אחד = מייל אחד, גם אם הכתובת מופיעה פעמיים
  return [...new Set(emails)];
}

const DEFAULT_DEPS: NotifySubmissionDeps = {
  loadAdminEmails: loadAdminEmailsFromDb,
  send: sendEmail,
};

/**
 * מודיע במייל לכל המנהלים על פנייה חדשה מהאתר (צור קשר / רעיון לשידוך),
 * עם קישור ישיר לחלון הפנייה. נקרא מפעולות הטפסים הציבוריים בתוך after(),
 * ולכן לעולם אינו מעכב ואינו מכשיל את שליחת הטופס. לעולם לא זורק.
 * מחזיר את מספר המיילים שנוסו (לבדיקות).
 */
export async function notifyAdminsOfNewContactSubmission(
  submission: NewContactSubmissionParams,
  deps: NotifySubmissionDeps = DEFAULT_DEPS,
): Promise<number> {
  try {
    const recipients = await deps.loadAdminEmails();
    if (recipients.length === 0) return 0;

    const content = buildAdminNewContactSubmissionEmail(submission);
    const results = await Promise.all(
      recipients.map((to) =>
        deps.send({
          to,
          subject: content.subject,
          text: content.text,
          html: content.html,
        }),
      ),
    );

    results.forEach((result) => {
      if (!result.ok) console.error(`${TAG}: שליחה למנהל נכשלה`, result.error);
    });
    return recipients.length;
  } catch (error) {
    console.error(`${TAG}: שגיאה לא צפויה`, error);
    return 0;
  }
}
