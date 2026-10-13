import { createAdminClient } from "@/lib/supabase/admin";
import { readTemplateId, sendEmail } from "@/lib/email/send-email";
import {
  CARD_APPROVAL_TEMPLATE_ENV,
  buildCardApprovalEmail,
  type CardApprovalDecision,
} from "@/lib/email/templates/card-approval";

type CardApprovalEmail = {
  ownerId: string;
  studentId: string;
  candidateName: string;
  decision: CardApprovalDecision;
  /** סיבת הדחייה שהמנהל כתב */
  reason?: string | null;
};

/**
 * מייל לבעל הכרטיס על אישור או דחייה. נקרא אחרי שהעדכון במסד הצליח, ולעולם
 * לא זורק: כשל במייל אינו סיבה להכשיל את ה-route, שכבר שינה את מצב הכרטיס
 * (וההתראה בפעמון נוצרת במסד בכל מקרה). כשל נרשם בלוג בלבד.
 */
export async function sendCardApprovalEmail(
  params: CardApprovalEmail,
): Promise<void> {
  const tag = `[card-approval-email] ${params.decision}`;
  try {
    const { data, error } = await createAdminClient().auth.admin.getUserById(
      params.ownerId,
    );
    const owner = data?.user;
    if (error || !owner?.email) {
      console.error(`${tag}: לא נמצאה כתובת מייל לבעל הכרטיס`, error?.message);
      return;
    }

    const rawFirstName: unknown = owner.user_metadata?.firstName;
    const content = buildCardApprovalEmail({
      decision: params.decision,
      studentId: params.studentId,
      candidateName: params.candidateName,
      ownerFirstName:
        typeof rawFirstName === "string" && rawFirstName.trim()
          ? rawFirstName.trim()
          : null,
      reason: params.reason ?? null,
    });

    const result = await sendEmail({
      to: owner.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      templateId: readTemplateId(CARD_APPROVAL_TEMPLATE_ENV[params.decision]),
      dynamicData: content.dynamicData,
    });
    if (!result.ok) {
      console.error(`${tag}: שליחת המייל נכשלה`, result.error);
    }
  } catch (error) {
    console.error(`${tag}: שגיאה לא צפויה`, error);
  }
}
