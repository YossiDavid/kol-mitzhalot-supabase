/**
 * מתי שדה או מקטע בטופס המיועדים מוצג - מקום אחד למרנדר (dynamic-field.tsx),
 * לאשף (student-form-wizard.tsx) ולכללי שדה החובה (required-fields.ts).
 * שדה שלא מוצג לעולם אינו חובה, ולכן שלושתם חייבים לחשב את אותו דבר.
 */

export interface FieldCondition {
  parameter: string;
  operator: "===" | "!==" | "includes" | "in";
  /** ל-`in`: מערך הערכים המותרים (למשל רק סוגי בעיה, לא ריק / עוד לא נבחר) */
  value: string | string[];
}

const INDEX_SEGMENT_PATTERN = /\[(\d+)\]/g;

/** "family.mechutanim.0.firstName" או "family.mechutanim[0].firstName" */
export function getValueByPath(source: unknown, path: unknown): unknown {
  if (typeof path !== "string" || !path) return undefined;
  const segments = path
    .replace(INDEX_SEGMENT_PATTERN, ".$1")
    .split(".")
    .filter(Boolean);

  return segments.reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function matchesCondition(condition: FieldCondition, values: unknown): boolean {
  const compareValue = getValueByPath(values, condition.parameter);
  switch (condition.operator) {
    case "===":
      return compareValue === condition.value;
    case "!==":
      return compareValue !== condition.value;
    case "includes":
      return Array.isArray(compareValue)
        ? compareValue.includes(condition.value)
        : typeof compareValue === "string" &&
            compareValue.includes(String(condition.value));
    case "in":
      return (
        Array.isArray(condition.value) &&
        condition.value.includes(String(compareValue ?? ""))
      );
    default:
      return true;
  }
}

/** בלי תנאים - מוצג. עם תנאים - רק כשכולם מתקיימים */
export function matchesConditions(
  conditions: readonly FieldCondition[] | undefined,
  values: unknown,
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => matchesCondition(condition, values));
}

/**
 * שם שדה בתוך רשומה חוזרת, לפי השורה:
 * ("family.mechutanim.firstName", "family.mechutanim", 0) → "family.mechutanim.0.firstName"
 */
export function resolveRepeaterPath(
  baseName: string,
  arrayName: string,
  index: number,
): string {
  if (baseName === arrayName) return `${arrayName}.${index}`;
  if (baseName.startsWith(`${arrayName}.`)) {
    const suffix = baseName.slice(arrayName.length + 1);
    return `${arrayName}.${index}.${suffix}`;
  }
  return baseName;
}

/** תנאי של שדה בשורה מתייחס לשדות של אותה שורה */
export function resolveRowConditions(
  conditions: readonly FieldCondition[] | undefined,
  arrayName: string,
  index: number,
): FieldCondition[] | undefined {
  return conditions?.map((condition) => ({
    ...condition,
    parameter: resolveRepeaterPath(condition.parameter, arrayName, index),
  }));
}
