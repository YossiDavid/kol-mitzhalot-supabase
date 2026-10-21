import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type AdminAnnouncementParams = {
  /** שם פרטי של הנמען; ריק = פנייה כללית */
  firstName: string | null;
  title: string;
  /** גוף ההודעה (טקסט גולמי; עובר בריחה ב-renderEmailLayout) */
  body: string;
};

const FOOTER_NOTE = "מייל זה נשלח מהנהלת קול מצהלות לכל השדכנים במערכת.";

/** מייל הודעת הנהלה לשדכן (ללא תבנית Dynamic - HTML מהמעטפת האחידה) */
export function buildAdminAnnouncementEmail(
  params: AdminAnnouncementParams,
): EmailContent {
  const greeting = params.firstName ? `שלום ${params.firstName},` : "שלום,";
  const appUrl = `${getAppOrigin()}/app`;
  const subject = params.title.trim();
  const paragraphs = [greeting, params.body.trim()];

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
      body: params.body.trim(),
      app_url: appUrl,
    },
  };
}
