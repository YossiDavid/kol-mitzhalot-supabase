import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type SubmissionReplyParams = {
  /** שם הפונה כפי שמילא בטופס (טקסט גולמי; עובר בריחה ב-renderEmailLayout) */
  name: string;
  subject: string | null;
  /** ההודעה המקורית של הפונה; ריקה = בלי ציטוט */
  originalMessage: string | null;
  /** תשובת המנהל (טקסט גולמי) */
  reply: string;
};

const SUBJECT_PREFIX = "תשובה לפנייתך";
/** נושא שהפונה הקליד נכנס לשורת הנושא - מקוצר ובלי שבירות שורה */
const MAX_SUBJECT_PART = 120;
const ORIGINAL_HEADER = "— הפנייה המקורית —";
const FOOTER_NOTE =
  "מייל זה נשלח מהנהלת קול מצהלות בתגובה לפנייתך באתר. ניתן להשיב ישירות למייל זה.";

function subjectLine(subject: string | null): string {
  const clean = (subject ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return SUBJECT_PREFIX;
  return `${SUBJECT_PREFIX}: ${clean.slice(0, MAX_SUBJECT_PART)}`;
}

/**
 * מייל התשובה לפונה מהאתר: התשובה ואחריה ציטוט של הפנייה המקורית.
 * כל ערך חופשי עובר בריחה בתוך renderEmailLayout.
 */
export function buildSubmissionReplyEmail(
  params: SubmissionReplyParams,
): EmailContent {
  const subject = subjectLine(params.subject);
  const name = params.name.trim();
  const reply = params.reply.trim();
  const original = params.originalMessage?.trim() ?? "";
  const originalSubject = params.subject?.trim() ?? "";

  const quoted = original
    ? [
        ORIGINAL_HEADER,
        ...(originalSubject ? [`נושא: ${originalSubject}`] : []),
        original,
      ].join("\n")
    : null;

  const paragraphs = [
    name ? `שלום ${name},` : "שלום,",
    reply,
    ...(quoted ? [quoted] : []),
  ];

  return {
    subject,
    text: paragraphs.join("\n\n"),
    html: renderEmailLayout({
      title: SUBJECT_PREFIX,
      paragraphs,
      footerNote: FOOTER_NOTE,
    }),
    dynamicData: {
      subject,
      name,
      reply,
      original_message: original,
    },
  };
}
