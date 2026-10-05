import { createAdminClient } from "@/lib/supabase/admin";
import { readTemplateId, sendEmail } from "@/lib/email/send-email";
import {
  APPLICATION_TEMPLATE_ENV,
  buildApplicationDecisionEmail,
  type ApplicationDecision,
  type ApplicationKind,
} from "@/lib/email/templates/application-decision";

type DecisionEmailParams = {
  applicantId: string;
  kind: ApplicationKind;
  decision: ApplicationDecision;
  /** סיבת דחייה, אם הוזנה */
  reason?: string | null;
};

/**
 * מייל למבקש על אישור/דחיית בקשת שדכן או איש צוות. נקרא אחרי שעדכון
 * הסטטוס הצליח, ולעולם לא זורק: כשל במייל אינו סיבה להכשיל את ה-route,
 * שכבר שינה מצב אצל המבקש. כשל נרשם בלוג בלבד.
 */
export async function sendApplicationDecisionEmail(
  params: DecisionEmailParams,
): Promise<void> {
  const tag = `[application-decision-email] ${params.kind}/${params.decision}`;
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
    const content = buildApplicationDecisionEmail({
      kind: params.kind,
      decision: params.decision,
      firstName:
        typeof rawFirstName === "string" && rawFirstName.trim()
          ? rawFirstName.trim()
          : null,
      reason: params.reason ?? null,
    });

    const result = await sendEmail({
      to: applicant.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      templateId: readTemplateId(APPLICATION_TEMPLATE_ENV[params.decision]),
      dynamicData: content.dynamicData,
    });

    if (!result.ok) {
      console.error(`${tag}: שליחת המייל נכשלה`, result.error);
    }
  } catch (error) {
    console.error(`${tag}: שגיאה לא צפויה`, error);
  }
}
