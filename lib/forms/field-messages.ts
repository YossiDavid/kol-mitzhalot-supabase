/**
 * הנוסח האחיד של הודעות שדה חובה בכל טפסי המערכת
 * (docs/design-refactor/PLAN.md, שלבים 1 ו-3).
 *
 * המשפט נבנה מהתווית שמוצגת למשתמש וסוג הפקד: "נא למלא שם פרטי",
 * "נא לבחור תפקיד במערכת", "נא להעלות קורות חיים". כך אותה הודעה נכתבת
 * במקום אחד גם בטופס המיועדים (features/students/.../field-messages.ts) וגם
 * בטפסי ההתחברות, ההגדרות, בקשות ההצטרפות והניהול.
 */

/** ההודעה כשאין תווית להיאחז בה */
export const GENERIC_REQUIRED_MESSAGE = "שדה חובה";

// "מתעתד בעז״ה:" / "מה עושה כיום?" / "שם הרב *" - סימן בסוף התווית לא נכנס למשפט
const TRAILING_PUNCTUATION_PATTERN = /[\s:?.*]+$/;

/** התווית בלי סימני הפיסוק והכוכבית שבסופה */
export function fieldSubject(label: string): string {
  return label.replace(TRAILING_PUNCTUATION_PATTERN, "").trim();
}

/** שדה הקלדה: "נא למלא שם פרטי" */
export function fillMessage(label: string): string {
  const subject = fieldSubject(label);
  return subject ? `נא למלא ${subject}` : GENERIC_REQUIRED_MESSAGE;
}

/** שדה בחירה או תאריך: "נא לבחור סטטוס אישי" */
export function chooseMessage(label: string): string {
  const subject = fieldSubject(label);
  return subject ? `נא לבחור ${subject}` : GENERIC_REQUIRED_MESSAGE;
}

/** שדה קובץ: "נא להעלות קורות חיים" */
export function uploadMessage(label: string): string {
  const subject = fieldSubject(label);
  return subject ? `נא להעלות ${subject}` : GENERIC_REQUIRED_MESSAGE;
}
