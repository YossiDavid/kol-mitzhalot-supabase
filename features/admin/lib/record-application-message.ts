import type { SupabaseClient } from "@supabase/supabase-js";

import type { ApplicationKind } from "@/lib/email/templates/application-decision";
import { APPLICATION_PAGE_PATH } from "@/lib/email/templates/application-message";

/** סוג ההתראה (נוסף ל-notifications_type_check במיגרציה 20261018090000) */
export const APPLICATION_MESSAGE_NOTIFICATION_TYPE = "application_message";

const NOTIFICATION_TITLE = "הודעה מההנהלה בנוגע לבקשתך";
/** תצוגה מקדימה בפעמון; ההודעה המלאה בעמוד הבקשה */
const NOTIFICATION_BODY_MAX_LENGTH = 200;

type RecordParams = {
  kind: ApplicationKind;
  applicantId: string;
  adminId: string;
  message: string;
};

export type RecordResult = { ok: true } | { ok: false };

function previewOf(message: string): string {
  return message.length > NOTIFICATION_BODY_MAX_LENGTH
    ? `${message.slice(0, NOTIFICATION_BODY_MAX_LENGTH)}…`
    : message;
}

/**
 * שומר את ההודעה ב-application_messages ויוצר התראת פעמון למבקש.
 * רץ עם לקוח service-role בלבד (אין הרשאות כתיבה למשתמשים). הנמען הוא
 * applicantId שנפתר בשרת משורת הבקשה. שגיאות נרשמות בלוג ולא נחשפות.
 */
export async function recordApplicationMessage(
  admin: SupabaseClient,
  params: RecordParams,
): Promise<RecordResult> {
  const { error: insertError } = await admin
    .from("application_messages")
    .insert({
      request_kind: params.kind,
      applicant_user_id: params.applicantId,
      admin_id: params.adminId,
      body: params.message,
    });

  if (insertError) {
    console.error("[application-message] שמירת ההודעה נכשלה", insertError);
    return { ok: false };
  }

  const { error: notifyError } = await admin.rpc("create_notification", {
    p_user_id: params.applicantId,
    p_type: APPLICATION_MESSAGE_NOTIFICATION_TYPE,
    p_title: NOTIFICATION_TITLE,
    p_body: previewOf(params.message),
    p_link: APPLICATION_PAGE_PATH[params.kind],
  });

  // ההודעה כבר נשמרה והמבקש יראה אותה בעמוד הבקשה; כשל בהתראה לא מבטל זאת
  if (notifyError) {
    console.error("[application-message] יצירת ההתראה נכשלה", notifyError);
  }
  return { ok: true };
}
