import type { ShidduchSide } from "@/features/shidduchim/lib/responses";

/**
 * עדכון הצד השני שההצעה ירדה מהפרק. לא אוטומטי: השדכן בוחר ניסוח ושולח.
 * תואם ל-CHECK על shidduch_closed_notices.message
 * (supabase/migrations/20261005140000_notifications_fixes.sql).
 */
export const CLOSED_NOTICE_MAX_LENGTH = 500;

/**
 * ניסוחים מוכנים. ניטרליים בכוונה: לא מציינים מי דחה ולא מדוע, כדי שלא
 * לפגוע באף אחד מהצדדים. ניסוח חופשי הוא באחריות השדכן.
 */
export const CLOSED_NOTICE_PRESETS = [
  {
    id: "not_relevant",
    label: "לא רלוונטית בשלב זה",
    text: "ההצעה אינה רלוונטית בשלב זה. בהצלחה רבה בהמשך הדרך.",
  },
  {
    id: "not_continuing",
    label: "לא תתקדם כרגע",
    text: "לאחר בחינה, ההצעה לא תתקדם כרגע. תודה על הזמן ועל המחשבה, ובהצלחה רבה.",
  },
  {
    id: "off_the_table",
    label: "ירדה מהפרק",
    text: "ההצעה ירדה מהפרק. תודה רבה על שיתוף הפעולה, ונשמח לעמוד לשירותכם בהצעות נוספות.",
  },
  {
    id: "will_keep_looking",
    label: "נמשיך לחפש",
    text: "תודה על העניין וההתייחסות. ההצעה לא תמשיך כעת, ונמשיך לחפש עבורכם התאמה מתאימה.",
  },
] as const;

export type ClosedNoticeRecord = {
  id: string;
  side: ShidduchSide;
  message: string;
  createdAt: string;
  /** האם יצא גם מייל (ולא רק התראה בפעמון) */
  emailSent: boolean;
};

/**
 * לאיזה צד לעדכן כברירת מחדל: הצד שלא דחה, מבין הצדדים שההצעה נשלחה אליהם.
 * null כשאין צד יחיד חד-משמעי (למשל נסגרה ידנית בלי תגובת דחייה) -
 * אז השדכן בוחר במפורש.
 */
export function defaultNoticeSide(
  recipientSides: readonly ShidduchSide[],
  declinedSides: readonly ShidduchSide[],
): ShidduchSide | null {
  const candidates = recipientSides.filter(
    (side) => !declinedSides.includes(side),
  );
  return candidates.length === 1 ? candidates[0] : null;
}
