import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type DisclosureOpenedEmailParams = {
  /** שם פרטי של מנהל הכרטיס; ריק = פנייה כללית */
  ownerFirstName: string | null;
  /** הפריטים שנפתחו, בעברית (למשל "קובץ קו״ח", "פרטי הממליצים") */
  items: readonly string[];
  /** הכרטיס של הצד השני, שבו המידע נפתח */
  otherStudentId: string;
};

/** מזהה תבנית SendGrid אופציונלי; בלעדיו נשלח ה-HTML שנבנה כאן */
export const DISCLOSURE_OPENED_TEMPLATE_ENV =
  "SENDGRID_TEMPLATE_ID_PROPOSAL_DISCLOSURE_OPENED";

const FOOTER_NOTE =
  "מייל זה נשלח אוטומטית כשהשדכן פותח מידע נוסף בהצעה שקיבלת.";

/** כל ערך חופשי עובר בריחה ב-renderEmailLayout */
export function buildDisclosureOpenedEmail(
  params: DisclosureOpenedEmailParams,
): EmailContent {
  const greeting = params.ownerFirstName
    ? `שלום ${params.ownerFirstName},`
    : "שלום,";
  const cardUrl = `${getAppOrigin()}/app/students/${params.otherStudentId}`;
  const items = params.items.join(", ");
  const subject = "השדכן פתח לך מידע נוסף בהצעה";
  const paragraphs = [
    greeting,
    `השדכן פתח לך מידע נוסף בכרטיס של הצד השני בהצעה: ${items}.`,
    "אפשר לראות אותו בכרטיס עצמו, במערכת.",
  ];
  return {
    subject,
    text: [
      ...paragraphs,
      "",
      `לכרטיס: ${cardUrl}`,
      "",
      "בברכה,",
      "קול מצהלות",
    ].join("\n"),
    html: renderEmailLayout({
      title: subject,
      paragraphs,
      cta: { label: "לכרטיס", url: cardUrl },
      footerNote: FOOTER_NOTE,
    }),
    dynamicData: {
      subject,
      first_name: params.ownerFirstName ?? "",
      items,
      card_url: cardUrl,
    },
  };
}
