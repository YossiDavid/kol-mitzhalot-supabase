import { getAppOrigin } from "@/lib/app-url";

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

type Personalization = { to?: { email?: string }[]; subject?: string };

/**
 * שליחה אמיתית רק ב-production. בפיתוח כתובת בדיקה שאינה קיימת נרשמת
 * כ-bounce בחשבון הדיוור, וכתובת אמיתית באמת מקבלת מייל מזהות השולח
 * של המערכת. לבדיקת מסירה אמיתית מכוונת: SENDGRID_SEND_IN_DEV=true
 */
function isRealSendingEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.SENDGRID_SEND_IN_DEV === "true"
  );
}

/** מזהה הודעה מהתגובה — לחיפוש ב-Email Activity ב-SendGrid */
async function sendSendGridRequest(
  body: Record<string, unknown>,
): Promise<{ messageId: string | null }> {
  if (!isRealSendingEnabled()) {
    const recipients =
      (body.personalizations as Personalization[] | undefined)?.flatMap(
        (p) => p.to?.map((t) => t.email).filter(Boolean) ?? [],
      ) ?? [];
    console.info(
      "[send-offer-email] פיתוח: המייל לא נשלח בפועל. נמענים:",
      recipients,
    );
    return { messageId: null };
  }

  const key = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || "קול מצהלות";

  if (!key || !fromEmail) {
    throw new Error(
      "SENDGRID_API_KEY או SENDGRID_FROM_EMAIL לא מוגדרים בסביבה",
    );
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      from: { email: fromEmail, name: fromName },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`SendGrid: ${res.status} ${errText}`);
  }

  const messageId = res.headers.get("x-message-id");
  return { messageId: messageId?.trim() || null };
}

function getShidduchTemplateId(): string | null {
  const id = process.env.SENDGRID_TEMPLATE_ID_SHIDDUCH_OFFER?.trim();
  return id || null;
}

async function sendOfferEmail(
  to: string,
  content: OfferEmailContent,
): Promise<{ messageId: string | null }> {
  // מייל בלי שורת נושא יצא בפועל למשתמש אמיתי (16.9.2026). עדיף להיכשל
  // בקול מאשר לשלוח הודעה ריקה. הנושא נשלח גם בהתאמה האישית וגם בנתוני
  // התבנית, כך שהוא אינו תלוי בהגדרה יחידה ב-SendGrid.
  if (!content.subject.trim()) {
    throw new Error("הצעת שידוך לא נשלחה: חסרה שורת נושא למייל");
  }

  const templateId = getShidduchTemplateId();
  if (templateId) {
    return sendSendGridRequest({
      personalizations: [
        {
          to: [{ email: to }],
          subject: content.subject,
          dynamic_template_data: content.templateData,
        },
      ],
      template_id: templateId,
    });
  }
  return sendSendGridRequest({
    personalizations: [{ to: [{ email: to }] }],
    subject: content.subject,
    content: [{ type: "text/plain", value: content.text }],
  });
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
