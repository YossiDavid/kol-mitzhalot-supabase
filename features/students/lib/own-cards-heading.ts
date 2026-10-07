/** עבור מי מולא הכרטיס (students.card_for). null בכרטיסים ישנים */
export type CardFor = "self" | "child" | "other" | null | undefined;

type CardWithOwner = { card_for?: CardFor };

/** הכותרת כשאין כרטיס, או כשיש כרטיס שמולא עבור אחרים */
const OTHERS_HEADING = "המיועדים שלך";
const SINGLE_SELF_HEADING = "הכרטיס שלי";
const MULTIPLE_SELF_HEADING = "הכרטיסים שלי";

/** כרטיס שמולא עבור בעליו עצמו. card_for ריק (כרטיס ישן) נחשב "לא עצמי" */
export function isSelfCard(card: CardWithOwner): boolean {
  return card.card_for === "self";
}

/** כל הכרטיסים של המשתמש מולאו לעצמו (ויש לפחות אחד) */
export function areAllSelfCards(cards: readonly CardWithOwner[]): boolean {
  return cards.length > 0 && cards.every(isSelfCard);
}

/**
 * כותרת אזור הכרטיסים של המשתמש בדשבורד. מועמד שמילא כרטיס לעצמו לא אמור
 * לראות ניסוח של הורה ("המיועדים שלך"): כרטיס אחד - "הכרטיס שלי", כמה -
 * "הכרטיסים שלי". כל מקרה אחר, כולל כרטיס ישן בלי card_for, נשאר "המיועדים שלך".
 */
export function ownCardsHeading(cards: readonly CardWithOwner[]): string {
  if (!areAllSelfCards(cards)) return OTHERS_HEADING;
  return cards.length === 1 ? SINGLE_SELF_HEADING : MULTIPLE_SELF_HEADING;
}

/** התיאור של אזור "שדכנים שפעלו בשבילך" - בגוף שמתאים לכותרת */
export function ownCardsShadchanimSubtitle(
  cards: readonly CardWithOwner[],
): string {
  return areAllSelfCards(cards)
    ? "שדכנים שהציעו שידוכים או צפו בקו”ח שלך"
    : "שדכנים שהציעו שידוכים או צפו בקו”ח של המיועדים שלך";
}

/** התווית הקטנה בשורת כרטיס עצמי */
export const SELF_CARD_TAG = SINGLE_SELF_HEADING;
