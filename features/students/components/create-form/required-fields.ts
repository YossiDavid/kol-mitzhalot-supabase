/**
 * שדה חובה בטופס המיועדים נקבע במקום אחד: `required: true` במערך השדות
 * (fields-data/). אותו סימון מציג כוכבית בתווית (dynamic-field.tsx) וכאן
 * נגזרים ממנו כללי האכיפה, שהסכמה (schema.ts) מריצה ב-superRefine - גם במעבר
 * שלב וגם בשליחה, ביצירה ובעריכה.
 *
 * - נאכף רק שדה שמוצג כרגע (אותם תנאים כמו במרנדר, field-visibility.ts).
 * - רשומה חוזרת: שדות החובה נאכפים בכל שורה קיימת. רשומה ריקה תקינה, אלא אם
 *   הרשומה עצמה סומנה required ("לפחות שורה אחת").
 */
import type { Field, FormSteps, RepeaterField } from "./fields-data";
import { GENERIC_REQUIRED_MESSAGE } from "./field-messages";
import {
  getValueByPath,
  matchesConditions,
  resolveRepeaterPath,
  resolveRowConditions,
} from "./field-visibility";

export interface RequiredIssue {
  /** נתיב השדה בערכי הטופס, למשל "family.mechutanim.0.firstName" */
  path: string;
  /** הודעה כללית מוחלפת במרנדר בנוסח לפי התווית (field-messages.ts) */
  message: string;
}

/**
 * האם ערך נחשב "לא מולא":
 * undefined / null / מחרוזת ריקה או רווחים / מערך ריק / שם עם תוארים בלי
 * השם עצמו / קובץ בודד בלי קובץ חדש ובלי קובץ שכבר שמור (עריכה).
 * תמונות שמורות הן פריטים במערך, ולכן גלריה עם תמונה שמורה אינה ריקה.
 */
export function isEmptyFieldValue(value: unknown, fieldType?: string): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return Number.isNaN(value);
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  if (fieldType === "textAndSelect") return isEmptyFieldValue(record.name);
  if ("file" in record) {
    return !record.file && isEmptyFieldValue(record.existingUrl);
  }
  return Object.values(record).every((part) => isEmptyFieldValue(part));
}

/** כל שדות החובה הריקים שמוצגים כרגע, בכל השלבים */
export function collectRequiredIssues(
  steps: readonly FormSteps[],
  values: unknown,
): RequiredIssue[] {
  return steps.flatMap((step) =>
    step.sections
      .filter((section) => matchesConditions(section.condition, values))
      .flatMap((section) =>
        section.fields.flatMap((field) => getFieldIssues(field, values)),
      ),
  );
}

function getFieldIssues(field: Field, values: unknown): RequiredIssue[] {
  if (!matchesConditions(field.condition, values)) return [];
  if (field.type === "repeater") return getRepeaterIssues(field, values);
  if (!field.required) return [];
  if (!isEmptyFieldValue(getValueByPath(values, field.name), field.type)) {
    return [];
  }
  return [{ path: field.name, message: getIssueMessage(field) }];
}

function getRepeaterIssues(
  field: RepeaterField,
  values: unknown,
): RequiredIssue[] {
  const rows = getValueByPath(values, field.name);
  const rowCount = Array.isArray(rows) ? rows.length : 0;

  if (rowCount === 0) {
    return field.required
      ? [{ path: field.name, message: getIssueMessage(field) }]
      : [];
  }

  return Array.from({ length: rowCount }, (_, index) => index).flatMap(
    (index) =>
      field.fields.flatMap((child) =>
        getFieldIssues(toRowField(child, field.name, index), values),
      ),
  );
}

/** שדה בשורה מסוימת: השם והתנאים מתייחסים לאותה שורה */
function toRowField(child: Field, arrayName: string, index: number): Field {
  return {
    ...child,
    name: resolveRepeaterPath(child.name, arrayName, index),
    condition: resolveRowConditions(child.condition, arrayName, index),
  } as Field;
}

function getIssueMessage(field: Field): string {
  return field.requiredMessage ?? GENERIC_REQUIRED_MESSAGE;
}
