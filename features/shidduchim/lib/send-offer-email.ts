import { getAppOrigin } from "@/lib/app-url";
import { readTemplateId, sendEmail } from "@/lib/email/send-email";

export type RecipientScope = "both" | "groom_only" | "bride_only";

type SendOfferParams = {
  recipientScope: RecipientScope;
  groomParentEmail: string | null;
  brideParentEmail: string | null;
  shadchanName: string;
  /** מזהה רשומת השידוך לאחר שמירה — לקישור במייל */
  shidduchId: string;
};

export type OfferEmailContent = {
  subject: string;
  /** גוף טקסט גולמי (כשאין תבנית Dynamic) */
  text: string;
  /** נתונים ל-Handlebars בתבנית SendGrid — תואם ל-email-templates/sendgrid/shidduch-offer.html */
  templateData: Record<string, unknown>;
};

const OFFER_EMAIL_SUBJECT = "התקבלה הצעת שידוך חדשה";

function offerPageUrl(shidduchId: string): string {
  return `${getAppOrigin()}/app/shidduchim/${shidduchId}`;
}

/**
 * תוכן המייל על הצעה חדשה: הודעה שהתקבלה הצעה, שם השדכן וקישור בלבד.
 * בכוונה בלי שמות המיועדים ובלי הערות השדכן - מי שרואה את השם כבר במייל
 * נוטה להתעלם, ומי שנכנס למערכת רואה את ההצעה המלאה ומגיב עליה.
 * זהה לכל הנמענים, בלי קשר לצד.
 */
export function buildOfferEmailContent(
  shadchanName: string,
  shidduchId: string,
): OfferEmailContent {
  const offerUrl = offerPageUrl(shidduchId);
  const text = [
    "שלום,",
    "",
    `התקבלה הצעת שידוך חדשה מהשדכן ${shadchanName}.`,
    "",
    `לצפייה בהצעה ולתגובה: ${offerUrl}`,
    "",
    "בברכה,",
    "קול מצהלות",
  ].join("\n");

  return {
    subject: OFFER_EMAIL_SUBJECT,
    text,
    templateData: {
      shadchan_name: shadchanName,
      offer_url: offerUrl,
      /** לשורת הנושא אם ב-SendGrid הוגדר Subject כ־{{subject}} */
      subject: OFFER_EMAIL_SUBJECT,
    },
  };
}

const OFFER_TEMPLATE_ENV = "SENDGRID_TEMPLATE_ID_SHIDDUCH_OFFER";

/** זורק כשל מסירה: הקורא (route ההצעה) מגלגל אחורה את השורה לפיו */
async function sendOfferEmail(
  to: string,
  content: OfferEmailContent,
): Promise<{ messageId: string | null }> {
  // מייל בלי שורת נושא יצא בפועל למשתמש אמיתי (16.9.2026). עדיף להיכשל
  // בקול מאשר לשלוח הודעה ריקה.
  if (!content.subject.trim()) {
    throw new Error("הצעת שידוך לא נשלחה: חסרה שורת נושא למייל");
  }

  // טקסט גולמי בלבד כשאין תבנית Dynamic, כמו תמיד - בלי html
  const result = await sendEmail({
    to,
    subject: content.subject,
    text: content.text,
    templateId: readTemplateId(OFFER_TEMPLATE_ENV),
    dynamicData: content.templateData,
  });

  if (!result.ok) throw new Error(result.error);
  return { messageId: result.messageId };
}

/**
 * שולח מיילים לפי scope. אם אין כתובת — מדלגת על צד זה (ללא שגיאה).
 * מנהל כרטיס ששני הצדדים שלו מקבל מייל אחד.
 *
 * אם מוגדר `SENDGRID_TEMPLATE_ID_SHIDDUCH_OFFER` — נעשה שימוש בתבנית Dynamic (HTML).
 * אחרת — נשלח טקסט גולמי.
 */
export async function sendShidduchOfferEmails(
  params: SendOfferParams,
): Promise<{
  sentTo: string[];
  /** מזהי SendGrid (תגובת X-Message-Id) — לחיפוש ב-Email Activity */
  sendGridMessageIds: string[];
}> {
  const content = buildOfferEmailContent(
    params.shadchanName,
    params.shidduchId,
  );
  const sentTo: string[] = [];
  const sendGridMessageIds: string[] = [];

  const sendGroom =
    params.recipientScope === "both" || params.recipientScope === "groom_only";
  const sendBride =
    params.recipientScope === "both" || params.recipientScope === "bride_only";

  const recipients = [
    sendGroom ? params.groomParentEmail : null,
    sendBride ? params.brideParentEmail : null,
  ].filter((email): email is string => Boolean(email?.trim()));

  const seen = new Set<string>();
  for (const email of recipients) {
    const normalized = email.trim().toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const { messageId } = await sendOfferEmail(email, content);
    if (messageId) sendGridMessageIds.push(messageId);
    sentTo.push(email);
  }

  if (sentTo.length === 0) {
    throw new Error("לא נמצאו כתובות מייל למנהלי הכרטיסים לצדדים שנבחרו");
  }

  return { sentTo, sendGridMessageIds };
}
