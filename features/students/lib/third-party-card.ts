/**
 * כרטיס שמולא על ידי צד שלישי (students.card_for = 'other'): שדכן, קרוב משפחה,
 * מכר או איש צוות. 'self' (המועמד/ת) ו-'child' (הורה) הם כרטיסים שמנוהלים
 * ישירות; כרטיס ישן בלי card_for (null) נחשב מנוהל ישירות.
 *
 * לצד שלישי מותר למלא את הטופס המלא. מה שמוגבל הוא התצוגה וההצעות, ושני
 * אישורי הנהלה בלתי תלויים משחררים אותם: "הצגת נתונים מלאים" ו"אפשרות
 * לשלוח הצעות" (students.third_party_*_approved_at, נכתבים רק על ידי מנהל).
 * עד האישור, מי שאינו בעל הכרטיס או מנהל רואה נתונים בסיסיים בלבד.
 *
 * הקובץ בלי תלות בלקוח או בשרת, ולכן משמש את הדפים, הרשימות והטופס.
 */

export const THIRD_PARTY_CARD_FOR = "other";

export function isThirdPartyCardFor(cardFor: unknown): boolean {
  return cardFor === THIRD_PARTY_CARD_FOR;
}

/** השדות של אישורי ההנהלה בשורת students */
export type ThirdPartyApprovalColumns = {
  card_for?: string | null;
  third_party_full_display_approved_at?: string | null;
  third_party_proposals_approved_at?: string | null;
};

/** שתי העמודות שרשימות וכרטיסים שולפים כדי להכריע (שמות עמודה מפורשים) */
export const THIRD_PARTY_APPROVAL_COLUMNS =
  "card_for, third_party_full_display_approved_at, third_party_proposals_approved_at";

/** צד שלישי שהנהלת המערכת עוד לא אישרה לו הצגה מלאה */
export function isFullDisplayPending(card: ThirdPartyApprovalColumns): boolean {
  return (
    isThirdPartyCardFor(card.card_for) &&
    !card.third_party_full_display_approved_at
  );
}

/** צד שלישי שהנהלת המערכת עוד לא אישרה לו קבלת הצעות */
export function isProposalsPending(card: ThirdPartyApprovalColumns): boolean {
  return (
    isThirdPartyCardFor(card.card_for) &&
    !card.third_party_proposals_approved_at
  );
}

/**
 * האם הצופה מוגבל לנתונים בסיסיים: כרטיס צד שלישי בלי אישור הצגה, והצופה
 * אינו מי שמנהל את הכרטיס (ממלא הכרטיס) ואינו מנהל מערכת.
 * אותו כלל נאכף במסד (student_display_restricted).
 */
export function isDisplayRestricted(
  card: ThirdPartyApprovalColumns,
  viewer: { isOwner: boolean; isAdmin: boolean },
): boolean {
  return isFullDisplayPending(card) && !viewer.isOwner && !viewer.isAdmin;
}

export const THIRD_PARTY_TAG_PENDING_LABEL = "מידע בסיסי · מולא ע״י צד שלישי";
export const THIRD_PARTY_TAG_APPROVED_LABEL = "מולא ע״י צד שלישי";

export function thirdPartyTagLabel(card: ThirdPartyApprovalColumns): string {
  return isFullDisplayPending(card)
    ? THIRD_PARTY_TAG_PENDING_LABEL
    : THIRD_PARTY_TAG_APPROVED_LABEL;
}

const BASIC_ONLY_SENTENCE =
  "מוצג מידע בסיסי בלבד, שאינו בסטנדרט של קול מצהלות. פרטים נוספים יוצגו לאחר אישור הנהלת המערכת.";
const FULL_DISPLAY_SENTENCE = "הנהלת המערכת אישרה הצגת נתונים מלאים.";
const PROPOSALS_PENDING_SENTENCE =
  "לא ניתן לשלוח אליו הצעות עד לאישור הנהלת המערכת.";
const PROPOSALS_APPROVED_SENTENCE = "הנהלת המערכת אישרה קבלת הצעות.";

/** ההסבר בטולטיפ: מתאר את המצב הנוכחי של שני האישורים */
export function thirdPartyTagExplanation(
  card: ThirdPartyApprovalColumns,
): string {
  return [
    "כרטיס שלא מולא על ידי המיועד/ת או ההורים.",
    isFullDisplayPending(card) ? BASIC_ONLY_SENTENCE : FULL_DISPLAY_SENTENCE,
    isProposalsPending(card)
      ? PROPOSALS_PENDING_SENTENCE
      : PROPOSALS_APPROVED_SENTENCE,
  ].join(" ");
}

/** הסירוב לשלוח הצעה (ה-routes והטריגר), וההסבר ליד כפתורי השליחה */
export const THIRD_PARTY_PROPOSAL_MESSAGE =
  "לא ניתן לשלוח הצעה לכרטיס שמולא על ידי צד שלישי וטרם אושר לקבלת הצעות על ידי הנהלת המערכת. אפשר לפנות לממלא הכרטיס בצ'אט.";

/** קוד השגיאה של הטריגר enforce_shidduch_card_gates ושל תשובת ה-routes */
export const THIRD_PARTY_BLOCK_CODE = "card_third_party";

/** במקום החלקים החבויים בכרטיס מוגבל, לשדכן */
export const THIRD_PARTY_HIDDEN_PARTS_NOTE =
  "פרטים נוספים בכרטיס זה יוצגו לאחר אישור הנהלת המערכת";

/** הנחיה לציבור, בתחילת מילוי כרטיס (שלב ההקדמה) */
export const CARD_GUIDANCE_TITLE = "לפני שממלאים: למי מיועד הכרטיס";
export const CARD_GUIDANCE_PARAGRAPHS: readonly string[] = [
  "המערכת נועדה בעיקר למיועדים עצמם ולהוריהם. הצעות שידוך נשלחות לכרטיסים שמולאו על ידי המיועד/ת או הוריו/ה, כי רק הם יכולים לענות עליהן.",
  "נא להימנע ממילוי כרטיס על אדם אחר, אלא אם יש לכך סיבה מוצדקת (למשל, אין למיועד/ת גישה למחשב). כרטיס שמולא על ידי אחר מוצג לשדכנים כמידע בסיסי בלבד, ואי אפשר לשלוח אליו הצעות עד שהנהלת המערכת תאשר אותו.",
];

/** תזכורת קצרה ליד הכניסה להוספת כרטיס בלוח הבקרה */
export const CARD_GUIDANCE_SHORT =
  "המערכת נועדה בעיקר למיועדים עצמם ולהוריהם. כרטיס שמולא על ידי אחר מוצג כמידע בסיסי, ואי אפשר לשלוח אליו הצעות עד לאישור הנהלת המערכת.";

/** ההשלכה של בחירה ב"אדם אחר" - מוצגת מיד אחרי הבחירה */
export const THIRD_PARTY_CONSEQUENCE_TITLE = "מילוי כרטיס עבור אדם אחר";
export const THIRD_PARTY_CONSEQUENCE_TEXT = `אפשר למלא את הטופס במלואו. עד שהנהלת המערכת תאשר, השדכנים יראו בכרטיס מידע בסיסי בלבד (פרטים אישיים, שמות ההורים, לימודים ותעסוקה, תמונות וקורות חיים), הכרטיס יסומן כ"${THIRD_PARTY_TAG_PENDING_LABEL}", ולא ניתן יהיה לשלוח אליו הצעות.`;

/** אורך הסבר "מדוע מילאת במקום המועמד/ההורים" */
export const FILL_REASON_MIN_LENGTH = 5;
export const FILL_REASON_MAX_LENGTH = 500;
