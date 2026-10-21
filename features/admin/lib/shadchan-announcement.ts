import { z } from "zod";

/**
 * הודעת הנהלה לכל השדכנים - הקבועים והסכמה המשותפים לדיאלוג ברשימת השדכנים,
 * לנתיב השליחה (app/api/v1/admin/shadchanim/announce) ולאישור שדכן חדש.
 */

/** סוג ההתראה (נוסף ל-notifications_type_check במיגרציה 20261102200000) */
export const ADMIN_ANNOUNCEMENT_NOTIFICATION_TYPE = "admin_announcement";

export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 200;
export const ANNOUNCEMENT_BODY_MAX_LENGTH = 2000;

/**
 * מדיניות ההפרשה למערכת על סגירת שידוך. ברירת המחדל של ההודעה לכל השדכנים,
 * ונשלחת גם לכל שדכן חדש עם אישור הבקשה (התראה ומייל).
 */
export const SHADCHAN_FEE_NOTICE = {
  title: "הפרשה למערכת על סגירת שידוך",
  body: "שדכן/ית יקר/ה, על כל שידוך שנסגר דרך המערכת יש להפריש למערכת 10% מדמי השדכנות שמתקבלים משני הצדדים, בעת קבלת דמי השדכנות, ולשלוח אסמכתא על ההעברה. תודה על שיתוף הפעולה!",
} as const;

export const announcementBodySchema = z.object({
  title: z.string().trim().min(1).max(ANNOUNCEMENT_TITLE_MAX_LENGTH),
  body: z.string().trim().min(1).max(ANNOUNCEMENT_BODY_MAX_LENGTH),
});

export type ShadchanAnnouncement = z.infer<typeof announcementBodySchema>;

/** תוצאת השליחה - מוצגת למנהל בהודעת ההצלחה */
export type AnnouncementResult = {
  recipients: number;
  emailsSent: number;
  emailsFailed: number;
  /** לא נשלחו בפועל כי הסביבה אינה production (ראו sendEmail) */
  emailsSkipped: number;
};

/** נוסח הודעת ההצלחה למנהל */
export function formatAnnouncementResult(result: AnnouncementResult): string {
  const parts = [`ההודעה נשלחה ל-${result.recipients} שדכנים`];
  if (result.emailsSent > 0) parts.push(`${result.emailsSent} מיילים נשלחו`);
  if (result.emailsSkipped > 0) {
    parts.push(`${result.emailsSkipped} מיילים לא נשלחו (סביבת פיתוח)`);
  }
  if (result.emailsFailed > 0) {
    parts.push(`${result.emailsFailed} מיילים נכשלו`);
  }
  return parts.join(" · ");
}
