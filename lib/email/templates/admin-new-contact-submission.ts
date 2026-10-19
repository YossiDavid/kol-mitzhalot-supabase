import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type NewContactSubmissionParams = {
  id: string;
  type: "contact" | "shidduch_idea";
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string | null;
};

const TYPE_LABEL: Record<NewContactSubmissionParams["type"], string> = {
  contact: "פנייה כללית",
  shidduch_idea: "רעיון לשידוך",
};

/** תקציר ההודעה במייל; הנוסח המלא נמצא בחלון הפנייה בניהול */
export const MESSAGE_EXCERPT_LENGTH = 300;
const NOT_PROVIDED = "לא צוין";

/** קישור ישיר לחלון הפנייה בדף הפניות של הניהול */
export function submissionAdminPath(id: string): string {
  return `/app/admin/content/submissions?id=${encodeURIComponent(id)}`;
}

function excerpt(message: string | null): string {
  const clean = (message ?? "").trim();
  if (clean.length <= MESSAGE_EXCERPT_LENGTH) return clean;
  return `${clean.slice(0, MESSAGE_EXCERPT_LENGTH).trimEnd()}…`;
}

export function buildAdminNewContactSubmissionEmail(
  params: NewContactSubmissionParams,
): EmailContent {
  const typeLabel = TYPE_LABEL[params.type];
  const subject = `פנייה חדשה מהאתר: ${typeLabel}`;
  const url = `${getAppOrigin()}${submissionAdminPath(params.id)}`;
  const messageExcerpt = excerpt(params.message);

  const paragraphs = [
    "שלום,",
    `התקבלה פנייה חדשה מהאתר (${typeLabel}).`,
    [
      `שם: ${params.name.trim() || NOT_PROVIDED}`,
      `אימייל: ${params.email.trim() || NOT_PROVIDED}`,
      `טלפון: ${params.phone?.trim() || NOT_PROVIDED}`,
      `נושא: ${params.subject?.trim() || NOT_PROVIDED}`,
    ].join("\n"),
    ...(messageExcerpt ? [`ההודעה:\n${messageExcerpt}`] : []),
  ];

  return {
    subject,
    text: [...paragraphs, "", `לצפייה ומענה: ${url}`].join("\n"),
    html: renderEmailLayout({
      title: subject,
      paragraphs,
      cta: { label: "לצפייה ומענה", url },
      footerNote: "מייל זה נשלח אוטומטית למנהלי המערכת עם כל פנייה חדשה מהאתר.",
    }),
    dynamicData: {
      subject,
      submission_url: url,
      name: params.name,
      message_excerpt: messageExcerpt,
    },
  };
}
