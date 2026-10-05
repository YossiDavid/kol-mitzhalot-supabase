import { createAdminClient } from "@/lib/supabase/admin";
import { readTemplateId, sendEmail } from "@/lib/email/send-email";
import {
  buildClosedNoticeEmail,
  CLOSED_NOTICE_TEMPLATE_ENV,
} from "@/lib/email/templates/shidduch-closed-notice";

const TAG = "[closed-notice-email]";
const FALLBACK_SHADCHAN_NAME = "השדכן";

type ClosedNoticeEmailParams = {
  noticeId: string;
  recipientUserId: string;
  shadchanId: string;
  message: string;
};

async function loadShadchanName(
  admin: ReturnType<typeof createAdminClient>,
  shadchanId: string,
): Promise<string> {
  const { data } = await admin
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("id", shadchanId)
    .maybeSingle();
  const name = `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim();
  return name || FALLBACK_SHADCHAN_NAME;
}

/**
 * שולח את הודעת "ההצעה ירדה מהפרק" במייל למנהל הכרטיס של הצד, ומתעד ב-
 * shidduch_closed_notices.email_sent_at רק אם המייל באמת יצא. לא זורק:
 * ההתראה בפעמון והתיעוד כבר נשמרו, והקורא מקבל true/false להצגה לשדכן.
 */
export async function sendClosedNoticeEmail(
  params: ClosedNoticeEmailParams,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(
      params.recipientUserId,
    );
    const recipientEmail = data?.user?.email;
    if (error || !recipientEmail) {
      console.error(`${TAG}: אין כתובת מייל לנמען`, error?.message);
      return false;
    }

    const shadchanName = await loadShadchanName(admin, params.shadchanId);
    const content = buildClosedNoticeEmail(shadchanName, params.message);
    const result = await sendEmail({
      to: recipientEmail,
      subject: content.subject,
      text: content.text,
      html: content.html,
      templateId: readTemplateId(CLOSED_NOTICE_TEMPLATE_ENV),
      dynamicData: content.dynamicData,
    });

    if (!result.ok) {
      console.error(`${TAG}: שליחת המייל נכשלה`, result.error);
      return false;
    }
    if (result.skipped) return false;

    const { error: markError } = await admin
      .from("shidduch_closed_notices")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", params.noticeId);
    if (markError) {
      console.error(`${TAG}: סימון המייל כנשלח נכשל`, markError.message);
    }
    return true;
  } catch (error) {
    console.error(`${TAG}: שגיאה לא צפויה`, error);
    return false;
  }
}
