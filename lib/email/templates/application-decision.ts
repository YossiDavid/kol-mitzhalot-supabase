import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type ApplicationKind = "shadchan" | "staff";
export type ApplicationDecision = "approved" | "rejected";

export type ApplicationDecisionParams = {
  kind: ApplicationKind;
  decision: ApplicationDecision;
  /** שם פרטי של המבקש; ריק = פנייה כללית */
  firstName: string | null;
  /** סיבת דחייה שהמנהל הזין, אם קיימת */
  reason: string | null;
};

/** תואם ל-email-templates/sendgrid/application-{approved,rejected}.html */
export const APPLICATION_TEMPLATE_ENV: Record<ApplicationDecision, string> = {
  approved: "SENDGRID_TEMPLATE_ID_APPLICATION_APPROVED",
  rejected: "SENDGRID_TEMPLATE_ID_APPLICATION_REJECTED",
};

const KIND_LABEL: Record<ApplicationKind, string> = {
  shadchan: "שדכן",
  staff: "איש צוות",
};

const FOOTER_NOTE = "מייל זה נשלח אוטומטית בעקבות בדיקת בקשת ההצטרפות שלך.";

export function buildApplicationDecisionEmail(
  params: ApplicationDecisionParams,
): EmailContent {
  const kindLabel = KIND_LABEL[params.kind];
  const greeting = params.firstName ? `שלום ${params.firstName},` : "שלום,";
  const appUrl = `${getAppOrigin()}/app`;
  const reason = params.reason?.trim() || "";

  if (params.decision === "approved") {
    const subject = `בקשתך להצטרף כ${kindLabel} אושרה`;
    const paragraphs = [
      greeting,
      `מזל טוב! בקשתך להצטרף למערכת קול מצהלות כ${kindLabel} אושרה.`,
      "מעכשיו אפשר להיכנס למערכת ולהתחיל לעבוד.",
    ];
    return {
      subject,
      text: [
        ...paragraphs,
        "",
        `לכניסה למערכת: ${appUrl}`,
        "",
        "בברכה,",
        "קול מצהלות",
      ].join("\n"),
      html: renderEmailLayout({
        title: subject,
        paragraphs,
        cta: { label: "כניסה למערכת", url: appUrl },
        footerNote: FOOTER_NOTE,
      }),
      dynamicData: {
        subject,
        first_name: params.firstName ?? "",
        kind_label: kindLabel,
        app_url: appUrl,
      },
    };
  }

  const subject = `עדכון לגבי בקשתך להצטרף כ${kindLabel}`;
  const paragraphs = [
    greeting,
    `תודה על פנייתך. לאחר בדיקה, לא נוכל לאשר כעת את בקשתך להצטרף למערכת קול מצהלות כ${kindLabel}.`,
    ...(reason ? [`סיבה שצוינה: ${reason}`] : []),
    "אם יש לך שאלות או שמשהו השתנה, אפשר לפנות אלינו ונשמח לבדוק שוב.",
  ];
  return {
    subject,
    text: [...paragraphs, "", "בברכה,", "קול מצהלות"].join("\n"),
    html: renderEmailLayout({
      title: subject,
      paragraphs,
      footerNote: FOOTER_NOTE,
    }),
    dynamicData: {
      subject,
      first_name: params.firstName ?? "",
      kind_label: kindLabel,
      reason,
    },
  };
}
