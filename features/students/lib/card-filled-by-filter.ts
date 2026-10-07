/**
 * סינון "מילוי הכרטיס" ברשימת המיועדים: כרטיסים שמולאו על ידי המועמד/ת או
 * ההורים, מול כרטיסים שמולאו על ידי צד שלישי (students.card_for = 'other').
 * כרטיס ישן בלי card_for שייך ל"מועמדים והורים". ריק = הכל.
 */

export type CardFilledByFilter = "direct" | "third_party";

export const CARD_FILLED_BY_FILTER_OPTIONS: ReadonlyArray<{
  value: CardFilledByFilter;
  label: string;
}> = [
  { value: "direct", label: "מועמדים והורים" },
  { value: "third_party", label: "צד שלישי" },
];

export function parseCardFilledByFilter(
  value: string | undefined,
): CardFilledByFilter | null {
  return value === "direct" || value === "third_party" ? value : null;
}
