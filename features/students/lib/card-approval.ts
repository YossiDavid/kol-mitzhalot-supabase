/**
 * אישור הנהלה לכרטיס: כל כרטיס חדש ממתין לאישור מנהל, ועד אז הוא גלוי לבעליו
 * ולמנהלים בלבד (נאכף במסד: students, student_cards, הטבלאות המקושרות ושער
 * ההצעות). מנהל מאשר או דוחה עם סיבה; בעל כרטיס שנדחה מתקן ושולח לאישור מחדש.
 * כרטיסים שהיו קיימים בהטמעה מאושרים.
 *
 * זהו שער נפרד ומוקדם משני האישורים של כרטיס צד שלישי (third-party-card.ts):
 * כרטיס צד שלישי עובר קודם את האישור הזה, ואחריו ממשיכים לחול עליו אישור
 * ההצגה המלאה ואישור קבלת ההצעות.
 *
 * מצב נוסף: "בלעדי למנהל" (admin_exclusive_at) - מאושר להצעות של המנהל בלבד,
 * ואינו מופיע במאגר. במסד הוא מאושר (admin_approved_at מלא) ולכן בעל הכרטיס
 * רואה "מאושר", ומי שקיבל עליו הצעה רואה אותו; שדכן ואיש צוות אינם רואים
 * אותו ואינם מציעים עליו (20261101100000_card_admin_exclusive.sql). העמודה
 * חוזרת מ-student_cards למנהל בלבד.
 *
 * הקובץ בלי תלות בלקוח או בשרת, ולכן משמש את הדפים, הרשימות והנתיבים.
 */

export type CardApprovalStatus =
  | "approved"
  | "exclusive"
  | "pending"
  | "rejected";

/** עמודות האישור כפי שהן נקראות מ-students או מ-student_cards */
export type CardApprovalColumns = {
  admin_approved_at?: string | null;
  admin_rejected_at?: string | null;
  admin_rejection_reason?: string | null;
  /** אישור להצעות המנהל בלבד. מ-student_cards: למנהל בלבד (לאחרים null) */
  admin_exclusive_at?: string | null;
};

/** העמודות שדף או רשימה שולפים כדי להכריע (שמות עמודה מפורשים) */
export const CARD_APPROVAL_COLUMNS =
  "admin_approved_at, admin_rejected_at, admin_rejection_reason, admin_exclusive_at";

/** מאושר רק כשיש רגע אישור; ערך חסר או ריק = לא מאושר (סגור כברירת מחדל) */
export function cardApprovalStatus(
  card: CardApprovalColumns,
): CardApprovalStatus {
  if (card.admin_approved_at) {
    return card.admin_exclusive_at ? "exclusive" : "approved";
  }
  return card.admin_rejected_at ? "rejected" : "pending";
}

/**
 * מאושר במסד: גם "בלעדי למנהל". מה שמבדיל אותו - מי רשאי לראות ולהציע -
 * נבדק בנפרד (isAdminExclusive).
 */
export function isCardApproved(card: CardApprovalColumns): boolean {
  const status = cardApprovalStatus(card);
  return status === "approved" || status === "exclusive";
}

/** אושר להצעות המנהל בלבד: אינו במאגר, ושדכן שאינו מנהל אינו מציע עליו */
export function isAdminExclusive(card: CardApprovalColumns): boolean {
  return cardApprovalStatus(card) === "exclusive";
}

/**
 * מתי הכרטיס הופיע לשדכנים: רגע האישור. "חדש היום/השבוע", הסינון "חדשים"
 * והמיון לפי תאריך הוספה נמדדים ממנו ולא מרגע היצירה - כרטיס שאושר שלושה ימים
 * אחרי שנוצר הוא חדש לשדכן ביום האישור. כרטיס מלפני ההטמעה אושר ברגע היצירה
 * שלו, ולכן אצלו שני הרגעים זהים. כרטיס שעוד לא אושר (נראה רק לבעליו) - רגע
 * היצירה.
 */
export function cardListedAt(card: {
  admin_approved_at?: string | null;
  created_at?: string | null;
}): string | null {
  return card.admin_approved_at ?? card.created_at ?? null;
}

/** העמודה שלפיה הרשימה מסננת "חדשים" וממיינת לפי תאריך הוספה */
export const CARD_LISTED_AT_COLUMN = "admin_approved_at";

export const CARD_APPROVAL_LABELS: Record<CardApprovalStatus, string> = {
  approved: "מאושר",
  exclusive: "מאושר להצעות ממני בלבד (לא מופיע במאגר)",
  pending: "ממתין לאישור ההנהלה",
  rejected: "נדחה",
};

export const CARD_PENDING_EXPLANATION =
  "הכרטיס נשמר, והוא ממתין לאישור הנהלת המערכת. עד האישור הוא אינו מוצג לשדכנים ואי אפשר לשלוח עליו הצעות. אפשר להמשיך לערוך אותו בינתיים, ונעדכן אותך כשיאושר.";

export const CARD_REJECTED_EXPLANATION =
  "הנהלת המערכת לא אישרה את הכרטיס, ולכן הוא אינו מוצג לשדכנים. אפשר לתקן אותו לפי ההערה ולשלוח אותו לאישור מחדש.";

/** אורך סיבת הדחייה שהמנהל כותב לבעל הכרטיס */
export const REJECTION_REASON_MIN_LENGTH = 3;
export const REJECTION_REASON_MAX_LENGTH = 500;

/**
 * דחייה "ללא שליחת הודעה לבעל הכרטיס" בלי סיבה: המסד דורש סיבה לכל כרטיס
 * שנדחה (students_admin_approval_state_check), ולכן נשמר הנוסח הזה. בעל הכרטיס
 * רואה אותו רק אם ייכנס לכרטיס - לא נשלחת אליו התראה או מייל.
 */
export const SILENT_REJECTION_DEFAULT_REASON = "לא צוינה סיבה";

/** התג הקצר של כרטיס בלעדי למנהל, ברשימות של המנהל */
export const ADMIN_EXCLUSIVE_TAG_LABEL = "בלעדי למנהל";

/** הכפתור והאישור שלפניו */
export const ADMIN_EXCLUSIVE_ACTION_LABEL =
  "אישור להצעות ממני בלבד (לא יופיע במאגר)";

/** פעולות המנהל בנתיב האישור (PATCH /api/v1/students/:id/approval) */
export type CardApprovalAction =
  | { action: "approve" }
  /** מאושר להצעות המנהל בלבד, ואינו מופיע במאגר */
  | { action: "exclusive" }
  | { action: "reject"; reason: string; silent?: boolean }
  /** כרטיס שנדחה (או בלעדי למנהל) חוזר ל"ממתין", בלי הודעה לבעליו */
  | { action: "reset" };

/** קוד הסירוב של הטריגר enforce_shidduch_card_gates ושל תשובת ה-routes */
export const CARD_PENDING_BLOCK_CODE = "card_pending_approval";

export const CARD_PENDING_PROPOSAL_MESSAGE =
  "לא ניתן לשלוח הצעה לכרטיס שהנהלת המערכת עוד לא אישרה.";

/** דף התור של המנהל. בלי פרמטרים - לשונית "ממתינים" (ברירת המחדל) */
export const NEW_CARDS_PATH = "/app/admin/new-cards";
