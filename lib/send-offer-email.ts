import { getAppOrigin } from "@/lib/app-url";

export type RecipientScope = "both" | "groom_only" | "bride_only";

type SendOfferParams = {
  recipientScope: RecipientScope;
  groomParentEmail: string | null;
  brideParentEmail: string | null;
  groomName: string;
  brideName: string;
  noteForGroom: string;
  noteForBride: string;
  shadchanName: string;
  /** מזהה רשומת השידוך לאחר שמירה — לקישור במייל */
  shidduchId: string;
};

type TemplateVariant = "both" | "groom_only" | "bride_only";

function offerPageUrl(shidduchId: string): string {
  const origin = getAppOrigin();
  return `${origin}/app/shidduchim/${shidduchId}`;
}

function buildEmailSubject(params: SendOfferParams): string {
  return `הצעת שידוך חדשה — ${params.groomName} ו${params.brideName}`;
}

/** נתונים ל-Handlebars בתבנית SendGrid — תואם ל-email-templates/sendgrid/shidduch-offer.html */
function buildDynamicTemplateData(
  params: SendOfferParams,
  variant: TemplateVariant,
): Record<string, unknown> {
  const offer_url = offerPageUrl(params.shidduchId);
  const subject = buildEmailSubject(params);
  return {
    groom_name: params.groomName,
    bride_name: params.brideName,
    shadchan_name: params.shadchanName,
    note_for_groom: params.noteForGroom.trim(),
    note_for_bride: params.noteForBride.trim(),
    offer_url,
    /** לשורת הנושא אם ב-SendGrid הוגדר Subject כ־{{subject}} */
    subject,
    is_both: variant === "both",
    is_groom_only: variant === "groom_only",
    is_bride_only: variant === "bride_only",
  };
}

function buildGroomBody(params: SendOfferParams): string {
  const url = offerPageUrl(params.shidduchId);
  const lines = [
    "שלום,",
    "",
    `קיבלת הצעת שידוך בנוגע למיועד ${params.groomName} (מול ${params.brideName}).`,
    "",
  ];
  if (params.noteForGroom.trim()) {
    lines.push("הערות מהשדכן:", params.noteForGroom.trim(), "");
  }
  lines.push(`לצפייה בכרטיס השידוך במערכת: ${url}`, "");
  lines.push(`בברכה, ${params.shadchanName}`, "", "קול מצהלות");
  return lines.join("\n");
}

function buildBrideBody(params: SendOfferParams): string {
  const url = offerPageUrl(params.shidduchId);
  const lines = [
    "שלום,",
    "",
    `קיבלת הצעת שידוך בנוגע למיועדת ${params.brideName} (מול ${params.groomName}).`,
    "",
  ];
  if (params.noteForBride.trim()) {
    lines.push("הערות מהשדכן:", params.noteForBride.trim(), "");
  }
  lines.push(`לצפייה בכרטיס השידוך במערכת: ${url}`, "");
  lines.push(`בברכה, ${params.shadchanName}`, "", "קול מצהלות");
  return lines.join("\n");
}

function buildCombinedBody(params: SendOfferParams): string {
  const url = offerPageUrl(params.shidduchId);
  const lines = [
    "שלום,",
    "",
    `קיבלת הצעת שידוך בין ${params.groomName} לבין ${params.brideName}.`,
    "",
  ];
  if (params.noteForGroom.trim()) {
    lines.push("הערות לצד המיועד:", params.noteForGroom.trim(), "");
  }
  if (params.noteForBride.trim()) {
    lines.push("הערות לצד המיועדת:", params.noteForBride.trim(), "");
  }
  lines.push(`לצפייה בכרטיס השידוך במערכת: ${url}`, "");
  lines.push(`בברכה, ${params.shadchanName}`, "", "קול מצהלות");
  return lines.join("\n");
}

/** מזהה הודעה מהתגובה — לחיפוש ב-Email Activity ב-SendGrid */
async function sendSendGridRequest(
  body: Record<string, unknown>,
): Promise<{ messageId: string | null }> {
  const key = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || "קול מצהלות";

  if (!key || !fromEmail) {
    throw new Error("SENDGRID_API_KEY או SENDGRID_FROM_EMAIL לא מוגדרים בסביבה");
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

/** טקסט גולמי (גיבוי כשאין תבנית Dynamic) */
async function sendSendGridPlainEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ messageId: string | null }> {
  return sendSendGridRequest({
    personalizations: [{ to: [{ email: to }] }],
    subject,
    content: [{ type: "text/plain", value: text }],
  });
}

async function sendSendGridTemplateEmail(
  to: string,
  templateId: string,
  dynamicTemplateData: Record<string, unknown>,
  subject: string,
): Promise<{ messageId: string | null }> {
  return sendSendGridRequest({
    personalizations: [
      {
        to: [{ email: to }],
        subject,
        dynamic_template_data: dynamicTemplateData,
      },
    ],
    template_id: templateId,
  });
}

function getShidduchTemplateId(): string | null {
  const id = process.env.SENDGRID_TEMPLATE_ID_SHIDDUCH_OFFER?.trim();
  return id || null;
}

/**
 * שולח מיילים לפי scope. אם אין כתובת — מדלגת על צד זה (ללא שגיאה).
 *
 * אם מוגדר `SENDGRID_TEMPLATE_ID_SHIDDUCH_OFFER` — נעשה שימוש בתבנית Dynamic (HTML).
 * אחרת — נשלח טקסט גולמי (תאימות לאחור).
 */
export async function sendShidduchOfferEmails(params: SendOfferParams): Promise<{
  sentTo: string[];
  /** מזהי SendGrid (תגובת X-Message-Id) — לחיפוש ב-Email Activity */
  sendGridMessageIds: string[];
}> {
  const subject = buildEmailSubject(params);
  const sentTo: string[] = [];
  const sendGridMessageIds: string[] = [];
  const templateId = getShidduchTemplateId();

  const sendGroom =
    params.recipientScope === "both" || params.recipientScope === "groom_only";
  const sendBride =
    params.recipientScope === "both" || params.recipientScope === "bride_only";

  const g = params.groomParentEmail?.trim().toLowerCase() || null;
  const b = params.brideParentEmail?.trim().toLowerCase() || null;

  const sendOne = async (
    to: string,
    variant: TemplateVariant,
    plainBody: string,
  ) => {
    let out: { messageId: string | null };
    if (templateId) {
      out = await sendSendGridTemplateEmail(
        to,
        templateId,
        buildDynamicTemplateData(params, variant),
        subject,
      );
    } else {
      out = await sendSendGridPlainEmail(to, subject, plainBody);
    }
    if (out.messageId) {
      sendGridMessageIds.push(out.messageId);
    }
  };

  if (g && b && g === b && sendGroom && sendBride) {
    await sendOne(
      params.groomParentEmail!,
      "both",
      buildCombinedBody(params),
    );
    sentTo.push(params.groomParentEmail!);
    return { sentTo, sendGridMessageIds };
  }

  if (sendGroom && params.groomParentEmail) {
    await sendOne(
      params.groomParentEmail,
      "groom_only",
      buildGroomBody(params),
    );
    sentTo.push(params.groomParentEmail);
  }

  if (sendBride && params.brideParentEmail) {
    await sendOne(
      params.brideParentEmail,
      "bride_only",
      buildBrideBody(params),
    );
    sentTo.push(params.brideParentEmail);
  }

  if (sentTo.length === 0) {
    throw new Error("לא נמצאו כתובות מייל למנהלי הכרטיסים לצדדים שנבחרו");
  }

  return { sentTo, sendGridMessageIds };
}
