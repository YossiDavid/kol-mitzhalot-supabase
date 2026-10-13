import { createAdminClient } from "@/lib/supabase/admin";
import { readTemplateId, sendEmail } from "@/lib/email/send-email";
import type { ApplicationKind } from "@/lib/email/templates/application-decision";
import {
  APPLICATION_MESSAGE_TEMPLATE_ENV,
  buildApplicationMessageEmail,
} from "@/lib/email/templates/application-message";

type MessageEmailParams = {
  /** נקבע בשרת משורת הבקשה, לעולם לא מקלט מהלקוח */
  applicantId: string;
  kind: ApplicationKind;
  message: string;
};

/**
 * מייל למבקש עם הודעה חופשית של מנהל. לעולם לא זורק: כשל במייל אינו מכשיל
 * את ה-route (ההודעה וההתראה כבר נשמרו). כשל נרשם בלוג בלבד.
 */
export async function sendApplicationMessageEmail(
  params: MessageEmailParams,
): Promise<void> {
  const tag = `[application-message-email] ${params.kind}`;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(
      params.applicantId,
    );
    const applicant = data?.user;

    if (error || !applicant?.email) {
      console.error(`${tag}: לא נמצאה כתובת מייל למבקש`, error?.message);
      return;
    }

    const rawFirstName: unknown = applicant.user_metadata?.firstName;
    const content = buildApplicationMessageEmail({
      kind: params.kind,
      firstName:
        typeof rawFirstName === "string" && rawFirstName.trim()
          ? rawFirstName.trim()
          : null,
      message: params.message,
    });

    const result = await sendEmail({
      to: applicant.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      templateId: readTemplateId(APPLICATION_MESSAGE_TEMPLATE_ENV),
      dynamicData: content.dynamicData,
    });

    if (!result.ok) {
      console.error(`${tag}: שליחת המייל נכשלה`, result.error);
    }
  } catch (error) {
    console.error(`${tag}: שגיאה לא צפויה`, error);
  }
}
