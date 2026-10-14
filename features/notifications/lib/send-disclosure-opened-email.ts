import { createAdminClient } from "@/lib/supabase/admin";
import { readTemplateId, sendEmail } from "@/lib/email/send-email";
import {
  DISCLOSURE_OPENED_TEMPLATE_ENV,
  buildDisclosureOpenedEmail,
} from "@/lib/email/templates/proposal-disclosure-opened";

/**
 * מייל למנהל כרטיס שהשדכן פתח לו מידע נוסף בהצעה. נשלח רק על התראה חדשה
 * (המסד ממזג פתיחות בתוך שעה להתראה אחת, ואז אין מייל נוסף). לעולם לא זורק:
 * השינוי במסד כבר נשמר וההתראה בפעמון כבר קיימת; כשל נרשם בלוג בלבד.
 */
export async function sendDisclosureOpenedEmail(params: {
  ownerId: string;
  otherStudentId: string;
  items: readonly string[];
}): Promise<void> {
  const tag = "[disclosure-opened-email]";
  try {
    const { data, error } = await createAdminClient().auth.admin.getUserById(
      params.ownerId,
    );
    const owner = data?.user;
    if (error || !owner?.email) {
      console.error(`${tag}: לא נמצאה כתובת מייל`, error?.message);
      return;
    }
    const rawFirstName: unknown = owner.user_metadata?.firstName;
    const content = buildDisclosureOpenedEmail({
      ownerFirstName:
        typeof rawFirstName === "string" && rawFirstName.trim()
          ? rawFirstName.trim()
          : null,
      items: params.items,
      otherStudentId: params.otherStudentId,
    });
    const result = await sendEmail({
      to: owner.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
      templateId: readTemplateId(DISCLOSURE_OPENED_TEMPLATE_ENV),
      dynamicData: content.dynamicData,
    });
    if (!result.ok) console.error(`${tag}: שליחת המייל נכשלה`, result.error);
  } catch (error) {
    console.error(`${tag}: שגיאה לא צפויה`, error);
  }
}
