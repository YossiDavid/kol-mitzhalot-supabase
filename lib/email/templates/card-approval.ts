import { getAppOrigin } from "@/lib/app-url";
import type { EmailContent } from "@/lib/email/send-email";
import { renderEmailLayout } from "@/lib/email/templates/layout";

export type CardApprovalDecision = "approved" | "rejected";

export type CardApprovalEmailParams = {
  decision: CardApprovalDecision;
  studentId: string;
  /** שם המועמד/ת שעל הכרטיס */
  candidateName: string;
  /** שם פרטי של בעל הכרטיס; ריק = פנייה כללית */
  ownerFirstName: string | null;
  /** סיבת הדחייה שהמנהל כתב; חובה בדחייה */
  reason: string | null;
};

/** מזהי תבנית SendGrid אופציונליים; בלעדיהם נשלח ה-HTML שנבנה כאן */
export const CARD_APPROVAL_TEMPLATE_ENV: Record<CardApprovalDecision, string> =
  {
    approved: "SENDGRID_TEMPLATE_ID_CARD_APPROVED",
    rejected: "SENDGRID_TEMPLATE_ID_CARD_REJECTED",
  };

const FOOTER_NOTE = "מייל זה נשלח אוטומטית בעקבות בדיקת הכרטיס שמילאת.";

/**
 * מייל לבעל הכרטיס על אישור או דחייה של הכרטיס על ידי הנהלת המערכת. כל ערך
 * חופשי (שם, סיבה) עובר בריחה ב-renderEmailLayout.
 */
export function buildCardApprovalEmail(
  params: CardApprovalEmailParams,
): EmailContent {
  const greeting = params.ownerFirstName
    ? `שלום ${params.ownerFirstName},`
    : "שלום,";
  const cardUrl = `${getAppOrigin()}/app/students/${params.studentId}`;
  const reason = params.reason?.trim() || "";
  const name = params.candidateName.trim();

  if (params.decision === "approved") {
    const subject = `הכרטיס של ${name} אושר`;
    const paragraphs = [
      greeting,
      `הכרטיס של ${name} אושר על ידי הנהלת קול מצהלות.`,
      "מעכשיו הכרטיס מוצג לשדכנים, ואפשר לקבל עליו הצעות.",
    ];
    return {
      subject,
      text: [
        ...paragraphs,
        "",
        `לצפייה בכרטיס: ${cardUrl}`,
        "",
        "בברכה,",
        "קול מצהלות",
      ].join("\n"),
      html: renderEmailLayout({
        title: subject,
        paragraphs,
        cta: { label: "לצפייה בכרטיס", url: cardUrl },
        footerNote: FOOTER_NOTE,
      }),
      dynamicData: {
        subject,
        first_name: params.ownerFirstName ?? "",
        candidate_name: name,
        card_url: cardUrl,
      },
    };
  }

  const subject = `עדכון לגבי הכרטיס של ${name}`;
  const paragraphs = [
    greeting,
    `הכרטיס של ${name} נבדק על ידי הנהלת קול מצהלות, ולא אושר כרגע. עד לאישור הוא אינו מוצג לשדכנים.`,
    ...(reason ? [`סיבה שצוינה: ${reason}`] : []),
    "אפשר לתקן את הכרטיס ולשלוח אותו לאישור מחדש מתוך דף הכרטיס.",
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
      cta: { label: "לתיקון הכרטיס", url: cardUrl },
      footerNote: FOOTER_NOTE,
    }),
    dynamicData: {
      subject,
      first_name: params.ownerFirstName ?? "",
      candidate_name: name,
      card_url: cardUrl,
      reason,
    },
  };
}
