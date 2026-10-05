/**
 * שולח המיילים הגנרי של המערכת, מעל SendGrid (fetch ישיר, בלי SDK).
 * כל מייל שיוצא מקוד שרת עובר כאן, כדי שכלל "לא שולחים בפיתוח" ותצורת
 * השולח יישבו במקום אחד.
 */

export type SendEmailParams = {
  to: string;
  subject: string;
  /** גוף טקסט גולמי. תמיד נשלח כשאין תבנית Dynamic */
  text: string;
  /** גוף HTML. אופציונלי: בלעדיו נשלח טקסט גולמי בלבד */
  html?: string;
  /** מזהה תבנית Dynamic ב-SendGrid (d-xxxx). כשמוגדר, נשלח דרכה ב-dynamicData */
  templateId?: string | null;
  dynamicData?: Record<string, unknown>;
};

/** תוכן מייל שנבנה מתבנית, לפני בחירת נמען */
export type EmailContent = {
  subject: string;
  text: string;
  html: string;
  /** נתונים ל-Handlebars בתבנית ה-Dynamic התואמת ב-email-templates/sendgrid */
  dynamicData: Record<string, unknown>;
};

/**
 * תוצאה מוקלדת - sendEmail לעולם לא זורק על כשל מסירה.
 * skipped = המייל לא נשלח בפועל כי הסביבה אינה production (ok נשאר true).
 */
export type SendEmailResult =
  | { ok: true; messageId: string | null; skipped: boolean }
  | { ok: false; error: string };

const SENDGRID_SEND_URL = "https://api.sendgrid.com/v3/mail/send";
const DEFAULT_FROM_NAME = "קול מצהלות";

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

/** מזהה תבנית Dynamic ממשתנה סביבה; ריק או חסר = ללא תבנית */
export function readTemplateId(envName: string): string | null {
  const id = process.env[envName]?.trim();
  return id || null;
}

function buildRequestBody(params: SendEmailParams): Record<string, unknown> {
  if (params.templateId) {
    return {
      personalizations: [
        {
          to: [{ email: params.to }],
          subject: params.subject,
          dynamic_template_data: params.dynamicData ?? {},
        },
      ],
      template_id: params.templateId,
    };
  }

  // SendGrid דורש text/plain לפני text/html
  const content = [{ type: "text/plain", value: params.text }];
  if (params.html) content.push({ type: "text/html", value: params.html });

  return {
    personalizations: [{ to: [{ email: params.to }] }],
    subject: params.subject,
    content,
  };
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  // מייל בלי שורת נושא יצא בפועל למשתמש אמיתי (16.9.2026). עדיף להיכשל
  // בקול מאשר לשלוח הודעה ריקה.
  if (!params.subject.trim()) {
    return { ok: false, error: "חסרה שורת נושא למייל" };
  }
  if (!params.to.trim()) {
    return { ok: false, error: "חסרה כתובת נמען" };
  }

  if (!isRealSendingEnabled()) {
    console.info("[email] פיתוח: המייל לא נשלח בפועל. נמען:", params.to);
    return { ok: true, messageId: null, skipped: true };
  }

  const key = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const fromName = process.env.SENDGRID_FROM_NAME || DEFAULT_FROM_NAME;

  if (!key || !fromEmail) {
    return {
      ok: false,
      error: "SENDGRID_API_KEY או SENDGRID_FROM_EMAIL לא מוגדרים בסביבה",
    };
  }

  try {
    const res = await fetch(SENDGRID_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...buildRequestBody(params),
        from: { email: fromEmail, name: fromName },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false, error: `SendGrid: ${res.status} ${errText}` };
    }

    // מזהה הודעה מהתגובה - לחיפוש ב-Email Activity ב-SendGrid
    const messageId = res.headers.get("x-message-id")?.trim() || null;
    return { ok: true, messageId, skipped: false };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
