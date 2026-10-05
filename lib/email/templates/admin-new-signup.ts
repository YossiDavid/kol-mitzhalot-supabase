import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type NewSignupParams = {
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
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
  const userUrl = `${getAppOrigin()}/app/admin/users/${params.userId}`;

  const paragraphs = [
    "שלום,",
    "משתמש חדש נרשם למערכת קול מצהלות.",
    `שם: ${name}\nאימייל: ${email}\nטלפון: ${phone}`,
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
      user_url: userUrl,
    },
  };
}
