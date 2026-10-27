import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

/** תבנית Dynamic אופציונלית ב-SendGrid; בלעדיה נשלח ה-HTML שנבנה כאן */
export const CHAT_MESSAGE_TEMPLATE_ENV = "SENDGRID_TEMPLATE_ID_CHAT_MESSAGE";

const SUBJECT = "הודעה חדשה בצ'אט - קול מצהלות";

/**
 * "יש לך הודעה חדשה". תוכן ההודעה עצמו אינו נשלח במייל (דיסקרטיות): רק מי
 * שלח, על מה השיחה, וקישור לשיחה.
 */
export function buildChatMessageEmail(params: {
  senderName: string;
  contextLabel: string | null;
  roomId: string;
}): EmailContent {
  const chatUrl = `${getAppOrigin()}/app/chats/${params.roomId}`;
  const about = params.contextLabel ? ` בנושא ${params.contextLabel}` : "";
  const intro = `${params.senderName} שלח/ה לך הודעה חדשה בצ'אט${about}.`;
  const paragraphs = [
    "שלום,",
    intro,
    "כדי לקרוא את ההודעה ולהשיב, יש להיכנס לשיחה באתר.",
  ];

  return {
    subject: SUBJECT,
    text: [
      ...paragraphs,
      "",
      `לשיחה: ${chatUrl}`,
      "",
      "בברכה,",
      "קול מצהלות",
    ].join("\n"),
    html: renderEmailLayout({
      title: SUBJECT,
      paragraphs,
      cta: { label: "לשיחה", url: chatUrl },
      footerNote:
        "מייל זה נשלח אוטומטית. על אותה שיחה יישלח לכל היותר מייל אחד בחצי שעה.",
    }),
    dynamicData: {
      subject: SUBJECT,
      sender_name: params.senderName,
      context_label: params.contextLabel ?? "",
      chat_url: chatUrl,
    },
  };
}
