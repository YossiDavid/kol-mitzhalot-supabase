import type { FieldGender, FieldOption } from "./field-control-types";

// קריאה בטוחה של ערכי טופס והגדרות שדה, משותפת לכל רכיבי השדות

const NON_ID_CHARACTERS = /[^a-zA-Z0-9]+/g;
const INDEX_SEGMENT_PATTERN = /\[(\d+)\]/g;

export function toFieldId(name: string): string {
  return name.replace(NON_ID_CHARACTERS, "-");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function ensureStringValue(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "";
}

export function ensureStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function readText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function readRecord<T = unknown>(
  value: unknown,
): Record<string, T> | undefined {
  return isRecord(value) ? (value as Record<string, T>) : undefined;
}

export function hasNonEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function splitPath(path: string): string[] {
  return path.replace(INDEX_SEGMENT_PATTERN, ".$1").split(".").filter(Boolean);
}

/** "education.kolel.0.id" → "education.kolel.0" */
export function getParentPath(path: string): string {
  return splitPath(path).slice(0, -1).join(".");
}

export function getLastPathSegment(path: string): string {
  return splitPath(path).at(-1) ?? "";
}

type RawOption = FieldOption & { labelMale?: string; labelFemale?: string };

/**
 * לייבל של אפשרות יכול להיות מגדרי ("רווק.ה" → "רווק" / "רווקה"). getLabel
 * מטפל רק בתווית של השדה, ולכן האפשרויות נפתרות כאן.
 */
export function resolveGenderedOptions(
  options: unknown,
  gender: FieldGender,
): FieldOption[] {
  const list = Array.isArray(options) ? (options as RawOption[]) : [];
  return list.map((option) => {
    const gendered =
      gender === "female"
        ? option.labelFemale
        : gender === "male"
          ? option.labelMale
          : undefined;
    return gendered ? { ...option, label: gendered } : option;
  });
}
