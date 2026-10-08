/**
 * האם מקטע בלוח הבקרה מציג נתונים. כשהוא ריק - הכפתור היחיד הוא זה שבתוך
 * תיבת המצב הריק; וכשהטעינה נכשלה אין כפתור בכלל. כפתור "לכל ה..." בכותרת
 * מוצג רק כשיש מה לראות.
 */
export function sectionHasData(
  items: readonly unknown[],
  failed: boolean,
): boolean {
  return !failed && items.length > 0;
}
