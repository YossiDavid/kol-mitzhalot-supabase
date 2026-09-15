/**
 * נוסח אחיד לשגיאת "שדה חובה" בטופס המיועדים (docs/design-refactor/PLAN.md, שלב 1).
 *
 * הסכמה (schema.ts) לא מכירה את התוויות, ובחלק מהשדות התווית תלויה במגדר.
 * לכן הסכמה מחזירה הודעה כללית, והמרנדר מחליף אותה כאן במשפט ספציפי לפי
 * התווית שמוצגת וסוג הפקד: "נא למלא שם פרטי", "נא לבחור סטטוס אישי".
 * הודעה ספציפית שכבר נכתבה בסכמה (למשל "גובה מינימלי הוא 50 ס״מ") נשארת.
 */

/** ההודעה שהסכמה מחזירה לשדה חובה ריק. המרנדר מחליף אותה בנוסח ספציפי */
export const GENERIC_REQUIRED_MESSAGE = "שדה חובה";

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

// "מתעתד בעז״ה:" / "מה עושה כיום?" - סימן בסוף התווית לא נכנס למשפט
const TRAILING_PUNCTUATION_PATTERN = /[\s:?.]+$/;

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
  const subject = label.replace(TRAILING_PUNCTUATION_PATTERN, "").trim();
  if (!subject) return GENERIC_REQUIRED_MESSAGE;
  if (CHOICE_FIELD_TYPES.has(fieldType)) return `נא לבחור ${subject}`;
  if (FILE_FIELD_TYPES.has(fieldType)) return `נא להעלות ${subject}`;
  return `נא למלא ${subject}`;
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
