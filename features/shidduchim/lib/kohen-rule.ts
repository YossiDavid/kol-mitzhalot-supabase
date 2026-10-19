/**
 * לכהן לא מציעים גרושה: מיועד שסומן כהן (students.is_kohen) אינו מוצע
 * למיועדת שהסטטוס שלה גרושה. הכלל נאכף במסד (enforce_shidduch_kohen_rule,
 * קוד kohen_divorced) וכאן הוא נבדק מראש - בלוח העבודה ובנתיבי ההצעה - כדי
 * שההודעה תהיה ברורה לפני כל כתיבה.
 *
 * הקובץ בלי תלות בלקוח או בשרת, ולכן משמש את הלוח, האבחון והנתיבים.
 */

export const KOHEN_DIVORCED_BLOCK_CODE = "kohen_divorced";

export const KOHEN_DIVORCED_MESSAGE = "לא ניתן להציע מיועדת גרושה למיועד כהן.";

/** העמודות שהכלל קורא מכל צד */
export type KohenRuleGroom = { is_kohen?: boolean | null };
export type KohenRuleBride = { personal_status?: string | null };

export function isKohenDivorcedPair(
  groom: KohenRuleGroom | null | undefined,
  bride: KohenRuleBride | null | undefined,
): boolean {
  return groom?.is_kohen === true && bride?.personal_status === "divorced";
}
