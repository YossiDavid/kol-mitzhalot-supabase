import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";
import type { ApplicationKind } from "@/lib/email/templates/application-decision";

export type ApplicationMessageParams = {
  kind: ApplicationKind;
  /** שם פרטי של המבקש; ריק = פנייה כללית */
  firstName: string | null;
  /** ההודעה החופשית של המנהל (טקסט גולמי; עוברת בריחה ב-renderEmailLayout) */
  message: string;
};

/** תואם ל-email-templates/sendgrid/application-message.html */
export const APPLICATION_MESSAGE_TEMPLATE_ENV =
  "SENDGRID_TEMPLATE_ID_APPLICATION_MESSAGE";

const KIND_LABEL: Record<ApplicationKind, string> = {
  shadchan: "שדכן",
  staff: "איש צוות",
};

/** הנתיב שבו המבקש רואה את הבקשה וההודעות מההנהלה */
export const APPLICATION_PAGE_PATH: Record<ApplicationKind, string> = {
  shadchan: "/app/settings/shadchan",
  staff: "/app/settings/staff",
};

const FOOTER_NOTE = "מייל זה נשלח מהנהלת קול מצהלות בעקבות בקשת ההצטרפות שלך.";

export function buildApplicationMessageEmail(
  params: ApplicationMessageParams,
): EmailContent {
  const kindLabel = KIND_LABEL[params.kind];
  const greeting = params.firstName ? `שלום ${params.firstName},` : "שלום,";
  const pageUrl = `${getAppOrigin()}${APPLICATION_PAGE_PATH[params.kind]}`;
  const subject = `הודעה בנוגע לבקשתך להצטרף כ${kindLabel}`;
  const message = params.message.trim();
  const paragraphs = [
    greeting,
    `קיבלת הודעה מהנהלת קול מצהלות בנוגע לבקשתך להצטרף כ${kindLabel}:`,
    message,
  ];

  return {
    subject,
    // טקסט פשוט: ההודעה נשארת גולמית (אין HTML לברוח ממנו)
    text: [
      ...paragraphs,
      "",
      `לצפייה בבקשה: ${pageUrl}`,
      "",
      "בברכה,",
      "קול מצהלות",
    ].join("\n"),
    html: renderEmailLayout({
      title: subject,
      paragraphs,
      cta: { label: "לצפייה בבקשה", url: pageUrl },
      footerNote: FOOTER_NOTE,
    }),
    dynamicData: {
      subject,
      first_name: params.firstName ?? "",
      kind_label: kindLabel,
      message,
      app_url: pageUrl,
    },
  };
}
