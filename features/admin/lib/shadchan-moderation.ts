import { z } from "zod";

/**
 * הקפאת שדכן והסרת הרשאות - גופי הבקשה המשותפים לנתיבים
 * (app/api/v1/admin/shadchanim/freeze, revoke) ולרכיבי הרשימה.
 */

/** אורך מקסימלי לסיבה (תואם ל-CHECK בעמודה frozen_reason / לסיבת דחייה) */
export const SHADCHAN_MODERATION_REASON_MAX_LENGTH = 1000;

const reasonSchema = z
  .string()
  .trim()
  .max(SHADCHAN_MODERATION_REASON_MAX_LENGTH);

export const freezeBodySchema = z.object({
  userId: z.guid(),
  /** true = הקפאה, false = ביטול הקפאה */
  frozen: z.boolean(),
  /** סיבת ההקפאה (רשות); ריקה אחרי trim נחשבת כלא הוזנה */
  reason: reasonSchema.transform((value) => value || null).optional(),
});

export const revokeBodySchema = z.object({
  userId: z.guid(),
  /** סיבת הסרת ההרשאות (חובה) - נשמרת כסיבת הדחייה ונשלחת בהתראה */
  reason: reasonSchema.min(1, "נא לכתוב סיבה"),
});

/** התראות לשדכן (סוג application_reviewed הקיים, קישור להגדרות) */
export const MODERATION_NOTIFICATION = {
  type: "application_reviewed",
  link: "/app/settings",
  frozenTitle: "חשבון השדכן שלך הוקפא",
  unfrozenTitle: "הקפאת חשבון השדכן שלך בוטלה",
  revokedTitle: "הרשאות השדכן שלך הוסרו",
  frozenBody: "הרשאות השדכן הוקפאו זמנית על ידי ההנהלה.",
  unfrozenBody: "הרשאות השדכן שלך חזרו לפעול.",
} as const;
