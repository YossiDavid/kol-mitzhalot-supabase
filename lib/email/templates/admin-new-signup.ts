import { getAppOrigin } from "@/lib/app-url";
import {
  getSignupPurposeLabel,
  isSignupPurpose,
} from "@/features/auth/lib/signup-purpose";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type NewSignupParams = {
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  /** הערך הגולמי של user_metadata.signup_purpose; חסר או לא מוכר = בלי שורה */
  signupPurpose?: string | null;
};

/** תואם ל-email-templates/sendgrid/admin-new-signup.html */
export const ADMIN_NEW_SIGNUP_TEMPLATE_ENV =
  "SENDGRID_TEMPLATE_ID_ADMIN_NEW_SIGNUP";

const SUBJECT = "משתמש חדש נרשם למערכת";
const NOT_PROVIDED = "לא צוין";

export function buildAdminNewSignupEmail(
  params: NewSignupParams,
): EmailContent {
  const name = params.fullName?.trim() || NOT_PROVIDED;
  const email = params.email?.trim() || NOT_PROVIDED;
  const phone = params.phone?.trim() || NOT_PROVIDED;
  const purposeLabel = isSignupPurpose(params.signupPurpose)
    ? getSignupPurposeLabel(params.signupPurpose)
    : null;
  const userUrl = `${getAppOrigin()}/app/admin/users/${params.userId}`;

  const paragraphs = [
    "שלום,",
    "משתמש חדש נרשם למערכת קול מצהלות.",
    [
      `שם: ${name}`,
      `אימייל: ${email}`,
      `טלפון: ${phone}`,
      ...(purposeLabel ? [`מטרת ההרשמה: ${purposeLabel}`] : []),
    ].join("\n"),
  ];

  return {
    subject: SUBJECT,
    text: [...paragraphs, "", `לכרטיס המשתמש: ${userUrl}`].join("\n"),
    html: renderEmailLayout({
      title: SUBJECT,
      paragraphs,
      cta: { label: "לכרטיס המשתמש", url: userUrl },
      footerNote: "מייל זה נשלח אוטומטית למנהלי המערכת עם כל הרשמה חדשה.",
    }),
    dynamicData: {
      subject: SUBJECT,
      user_name: name,
      user_email: email,
      user_phone: phone,
      // ריק כשאין מטרה מוכרת - התבנית מציגה את השורה רק כשיש ערך
      signup_purpose: purposeLabel ?? "",
      user_url: userUrl,
    },
  };
}
