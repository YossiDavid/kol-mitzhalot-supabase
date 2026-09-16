/**
 * מתי להחליף הודעת שגיאה בטופס המיועדים (docs/design-refactor/PLAN.md, שלב 1).
 *
 * הסכמה (schema.ts) לא מכירה את התוויות, ובחלק מהשדות התווית תלויה במגדר.
 * לכן הסכמה מחזירה הודעה כללית, והמרנדר מחליף אותה כאן במשפט ספציפי לפי
 * התווית שמוצגת וסוג הפקד: "נא למלא שם פרטי", "נא לבחור סטטוס אישי".
 * הודעה ספציפית שכבר נכתבה בסכמה (למשל "גובה מינימלי הוא 50 ס״מ") נשארת.
 *
 * הנוסח עצמו משותף לכל טפסי המערכת (lib/forms/field-messages.ts), כדי
 * שטפסי ההתחברות, ההגדרות והניהול ידברו באותה שפה.
 */

import {
  chooseMessage,
  fillMessage,
  GENERIC_REQUIRED_MESSAGE,
  uploadMessage,
} from "@/lib/forms/field-messages";

export { GENERIC_REQUIRED_MESSAGE };

const GENERIC_MESSAGES: ReadonlySet<string> = new Set([
  GENERIC_REQUIRED_MESSAGE,
  "שדה לא תקין",
  "Required",
]);

// ברירות המחדל של zod כשערך חסר או ריק ("Invalid input: expected string...")
const ZOD_DEFAULT_MESSAGE_PATTERN = /^(Invalid input|Too small|Required)/;

const CHOICE_FIELD_TYPES: ReadonlySet<string> = new Set([
  "select",
  "select2",
  "radio",
  "chips",
  "chip",
  "checkbox",
  "date",
]);

const FILE_FIELD_TYPES: ReadonlySet<string> = new Set(["upload", "photos"]);

export function isGenericErrorMessage(message: string): boolean {
  const trimmed = message.trim();
  return (
    !trimmed ||
    GENERIC_MESSAGES.has(trimmed) ||
    ZOD_DEFAULT_MESSAGE_PATTERN.test(trimmed)
  );
}

/** "נא למלא <תווית>" לשדות הקלדה, "נא לבחור <תווית>" לבחירה ולתאריך */
export function getRequiredFieldMessage(
  label: string,
  fieldType: string,
): string {
  if (CHOICE_FIELD_TYPES.has(fieldType)) return chooseMessage(label);
  if (FILE_FIELD_TYPES.has(fieldType)) return uploadMessage(label);
  return fillMessage(label);
}

/** רשומה חוזרת שסומנה חובה ואין בה שורות: "נא להוסיף מחותן" */
export function getRepeaterRequiredMessage(
  message: string,
  itemLabel: string,
): string {
  return isGenericErrorMessage(message) ? `נא להוסיף ${itemLabel}` : message;
}

/**
 * ההודעה שמוצגת מתחת לשדה: הודעה כללית מוחלפת בנוסח הספציפי, והודעה
 * ספציפית מהסכמה נשארת כמו שהיא.
 */
export function formatFieldErrorMessage(
  message: string,
  label: string,
  fieldType: string,
): string {
  return isGenericErrorMessage(message)
    ? getRequiredFieldMessage(label, fieldType)
    : message;
}
