import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

/** תואם ל-email-templates/sendgrid/shidduch-closed-notice.html */
export const CLOSED_NOTICE_TEMPLATE_ENV =
  "SENDGRID_TEMPLATE_ID_SHIDDUCH_CLOSED_NOTICE";

const SUBJECT = "עדכון בנוגע להצעת שידוך";

/**
 * הודעת השדכן לצד שני. הטקסט הוא הניסוח שהשדכן בחר - הוא האחראי עליו.
 * החלקים האוטומטיים כאן ניטרליים בכוונה: לא נאמר מי דחה ולא מדוע.
 */
export function buildClosedNoticeEmail(
  shadchanName: string,
  message: string,
): EmailContent {
  const proposalsUrl = `${getAppOrigin()}/app/proposals`;
  const intro = `עדכון מהשדכן ${shadchanName} בנוגע להצעת שידוך שנשלחה אליכם:`;
  const paragraphs = ["שלום,", intro, message];

  return {
    subject: SUBJECT,
    text: [
      ...paragraphs,
      "",
      `להצעות שלכם: ${proposalsUrl}`,
      "",
      "בברכה,",
      "קול מצהלות",
    ].join("\n"),
    html: renderEmailLayout({
      title: SUBJECT,
      paragraphs,
      cta: { label: "להצעות שלי", url: proposalsUrl },
      footerNote: "מייל זה נשלח אוטומטית מהמערכת בשם השדכן.",
    }),
    dynamicData: {
      subject: SUBJECT,
      shadchan_name: shadchanName,
      message,
      proposals_url: proposalsUrl,
    },
  };
}
