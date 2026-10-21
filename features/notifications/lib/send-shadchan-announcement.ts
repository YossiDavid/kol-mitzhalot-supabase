import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  ADMIN_ANNOUNCEMENT_NOTIFICATION_TYPE,
  SHADCHAN_FEE_NOTICE,
  type AnnouncementResult,
  type ShadchanAnnouncement,
} from "@/features/admin/lib/shadchan-announcement";
import { sendEmail, type SendEmailResult } from "@/lib/email/send-email";
import { buildAdminAnnouncementEmail } from "@/lib/email/templates/admin-announcement";

const TAG = "[shadchan-announcement]";

/**
 * כמה מיילים נשלחים במקביל. המנות רצות בזו אחר זו, כדי לא להציף את ספק
 * הדיוור (ואת הפונקציה) כשיש הרבה שדכנים.
 */
const EMAIL_BATCH_SIZE = 10;

const recipientSchema = z.object({
  recipient_id: z.string(),
  email: z.string().nullable(),
  first_name: z.string().nullable(),
});

type Recipient = z.infer<typeof recipientSchema>;

function chunk<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

async function emailRecipient(
  recipient: Recipient & { email: string },
  announcement: ShadchanAnnouncement,
): Promise<SendEmailResult> {
  const content = buildAdminAnnouncementEmail({
    firstName: recipient.first_name?.trim() || null,
    title: announcement.title,
    body: announcement.body,
  });
  return sendEmail({
    to: recipient.email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    dynamicData: content.dynamicData,
  });
}

/** שליחת המיילים במנות; sendEmail לעולם לא זורק, ולכן כל נמען נספר */
async function emailRecipients(
  recipients: readonly Recipient[],
  announcement: ShadchanAnnouncement,
): Promise<Omit<AnnouncementResult, "recipients">> {
  const withEmail = recipients.filter(
    (r): r is Recipient & { email: string } => Boolean(r.email?.trim()),
  );
  let results: readonly SendEmailResult[] = [];
  for (const batch of chunk(withEmail, EMAIL_BATCH_SIZE)) {
    const batchResults = await Promise.all(
      batch.map((r) => emailRecipient(r, announcement)),
    );
    results = [...results, ...batchResults];
  }

  const failed = results.filter((result) => !result.ok);
  failed.forEach((result) => console.error(`${TAG}: שליחת מייל נכשלה`, result));
  const missingEmail = recipients.length - withEmail.length;
  if (missingEmail > 0) {
    console.error(`${TAG}: ${missingEmail} שדכנים בלי כתובת מייל`);
  }

  return {
    emailsSent: results.filter((r) => r.ok && !r.skipped).length,
    emailsSkipped: results.filter((r) => r.ok && r.skipped).length,
    emailsFailed: failed.length + missingEmail,
  };
}

/**
 * הודעת הנהלה לכל השדכנים המאושרים שאינם מוקפאים: התראה בפעמון (במסד, בפעולה
 * אחת) ואחריה מייל לכל אחד. לקוח service role בלבד - הנתיב מוודא מנהל.
 * כשל ביצירת ההתראות זורק; כשל במייל נספר בתוצאה בלבד.
 */
export async function broadcastShadchanAnnouncement(
  admin: SupabaseClient,
  announcement: ShadchanAnnouncement,
): Promise<AnnouncementResult> {
  const { data, error } = await admin.rpc("send_shadchan_announcement", {
    p_title: announcement.title,
    p_body: announcement.body,
  });
  if (error) {
    throw new Error(`יצירת ההתראות נכשלה: ${error.message}`);
  }

  const recipients = z.array(recipientSchema).parse(data ?? []);
  const emails = await emailRecipients(recipients, announcement);
  return { recipients: recipients.length, ...emails };
}

/**
 * התראת פעמון על מדיניות ההפרשה לשדכן שאושר זה עתה. המייל עצמו מצורף למייל
 * האישור (notice), כדי לא לשלוח שני מיילים. לעולם לא זורק.
 */
export async function notifyNewShadchanFeePolicy(
  admin: SupabaseClient,
  shadchanId: string,
): Promise<void> {
  const { error } = await admin.rpc("create_notification", {
    p_user_id: shadchanId,
    p_type: ADMIN_ANNOUNCEMENT_NOTIFICATION_TYPE,
    p_title: SHADCHAN_FEE_NOTICE.title,
    p_body: SHADCHAN_FEE_NOTICE.body,
  });
  if (error) {
    console.error(`${TAG}: התראת ההפרשה לשדכן חדש נכשלה`, error);
  }
}
