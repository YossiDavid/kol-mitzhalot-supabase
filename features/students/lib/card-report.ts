import { z } from "zod";

/** סיבות הדיווח הקבועות. חייבות להיות זהות ל-CHECK בטבלה card_reports */
export const CARD_REPORT_REASONS = [
  "wrong_details",
  "duplicate_card",
  "inappropriate_content",
  "no_longer_available",
  "other",
] as const;

export type CardReportReason = (typeof CARD_REPORT_REASONS)[number];

export const CARD_REPORT_REASON_LABELS: Record<CardReportReason, string> = {
  wrong_details: "פרטים שגויים",
  duplicate_card: "כרטיס כפול",
  inappropriate_content: "תוכן לא הולם",
  no_longer_available: "המיועד/ת כבר לא בשידוכים",
  other: "אחר",
};

export const CARD_REPORT_DETAILS_MAX_LENGTH = 1000;

/** הודעות קבועות לפי הקוד ש-report_student_card מחזירה */
export const CARD_REPORT_RESULTS: Record<
  string,
  { status: number; error: string }
> = {
  authentication_required: { status: 401, error: "יש להתחבר מחדש" },
  invalid_reason: { status: 400, error: "יש לבחור סיבת דיווח" },
  details_required: {
    status: 400,
    error: 'בסיבה "אחר" יש לפרט את הדיווח',
  },
  details_too_long: { status: 400, error: "הפירוט ארוך מדי" },
  card_not_visible: {
    status: 403,
    error: "אין לך הרשאה לצפות בכרטיס הזה",
  },
  own_card: { status: 403, error: "אי אפשר לדווח על כרטיס שלך" },
  already_reported: {
    status: 409,
    error: "כבר דיווחת על הכרטיס הזה והדיווח ממתין לטיפול",
  },
  daily_limit_reached: {
    status: 429,
    error: "הגעת למכסת הדיווחים היומית. נסו שוב מחר",
  },
};

export const cardReportBodySchema = z
  .object({
    reason: z.enum(CARD_REPORT_REASONS),
    details: z
      .string()
      .trim()
      .max(CARD_REPORT_DETAILS_MAX_LENGTH, "הפירוט ארוך מדי")
      .optional(),
  })
  .refine((body) => body.reason !== "other" || Boolean(body.details), {
    path: ["details"],
    message: 'בסיבה "אחר" יש לפרט את הדיווח',
  });
