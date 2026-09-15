import { resolveRepeaterPath, resolveRowConditions } from "../field-visibility";
import type { FieldMetadata } from "./field-control-types";
import { getLastPathSegment, getParentPath, isRecord } from "./field-values";

// שורות של רשומה חוזרת: שמות ותנאים לפי השורה, והערך ההתחלתי של שורה חדשה

const ID_SEGMENT = "id";

function childFields(repeater: FieldMetadata): FieldMetadata[] {
  return Array.isArray(repeater.fields) ? repeater.fields : [];
}

/** שדות "id" בשורה - בורר "לבחירה מתוך המאגר". כשנבחר, שאר השורה נעולה */
export function getRowIdFieldPaths(
  repeater: FieldMetadata,
  index: number,
): Set<string> {
  return new Set(
    childFields(repeater)
      .filter(
        (candidate) =>
          typeof candidate.name === "string" &&
          getLastPathSegment(candidate.originalName ?? candidate.name) ===
            ID_SEGMENT,
      )
      .map((candidate) =>
        resolveRepeaterPath(candidate.name, repeater.name, index),
      ),
  );
}

function determineLinkedIdPath(
  fieldName: string,
  idFieldPaths: ReadonlySet<string>,
): string | undefined {
  if (idFieldPaths.size === 0) return undefined;
  if (idFieldPaths.has(fieldName)) return fieldName;

  const parentPath = getParentPath(fieldName);
  if (!parentPath) return undefined;

  const candidate = `${parentPath}.${ID_SEGMENT}`;
  return idFieldPaths.has(candidate) ? candidate : undefined;
}

/**
 * האם בחירה בבורר המאגר נועלת את השדה. בורר עם fillOnSelect נועל רק את
 * השדות שהוא ממלא - שדה שהטבלה לא מספקת לו ערך (למשל קהילה במוסדות) חייב
 * להישאר פתוח, אחרת אי אפשר למלא אותו. בורר בלי fillOnSelect נועל את כל השורה.
 */
function isLockedBySelection(
  fieldName: string,
  linkedIdPath: string,
  repeater: FieldMetadata,
  index: number,
): boolean {
  if (fieldName === linkedIdPath) return true;
  const idField = childFields(repeater).find(
    (candidate) =>
      resolveRepeaterPath(candidate.name, repeater.name, index) ===
      linkedIdPath,
  );
  const fillOnSelect = idField?.fillOnSelect;
  if (!isRecord(fillOnSelect)) return true;
  return Object.keys(fillOnSelect).includes(getLastPathSegment(fieldName));
}

/** שם, תנאים ושדות מקוננים (רשימה בתוך השורה) לפי השורה */
function resolveForRow(
  field: FieldMetadata,
  arrayName: string,
  index: number,
): FieldMetadata {
  return {
    ...field,
    name: resolveRepeaterPath(field.name, arrayName, index),
    condition: resolveRowConditions(field.condition, arrayName, index),
    originalName: field.originalName ?? field.name,
    ...(Array.isArray(field.fields)
      ? {
          fields: field.fields.map((nested: FieldMetadata) =>
            resolveForRow(nested, arrayName, index),
          ),
        }
      : {}),
  };
}

/** הגדרת שדה בשורה מסוימת: השם והתנאים לפי השורה, והקישור לבורר המאגר */
export function toRowFieldConfig(
  innerField: FieldMetadata,
  repeater: FieldMetadata,
  index: number,
  idFieldPaths: ReadonlySet<string>,
): FieldMetadata {
  const rowField = resolveForRow(innerField, repeater.name, index);
  const resolvedName: string = rowField.name;
  const linkedIdPath = determineLinkedIdPath(resolvedName, idFieldPaths);
  return {
    ...rowField,
    isIdField: idFieldPaths.has(resolvedName),
    linkedIdPath:
      linkedIdPath &&
      isLockedBySelection(resolvedName, linkedIdPath, repeater, index)
        ? linkedIdPath
        : undefined,
  };
}

function getDefaultValueForField(field: FieldMetadata): unknown {
  switch (field.type) {
    case "chip":
    case "chips":
    case "checkbox":
    case "childrenList":
      return [];
    case "range":
    case "rangeDouble":
      return [0, 0];
    case "switch":
      return false;
    case "upload":
      return field.name.endsWith(".documents") ? [] : { file: null };
    case "textAndSelect":
      return { prefix: "", name: "", suffix: "" };
    default:
      return "";
  }
}

function getRelativePath(originalName: string, arrayName: string): string {
  if (originalName === arrayName) return "";
  if (originalName.startsWith(`${arrayName}.`)) {
    return originalName.slice(arrayName.length + 1);
  }
  return originalName;
}

function withNestedValue(
  target: Record<string, unknown>,
  segments: readonly string[],
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = segments;
  if (rest.length === 0) return { ...target, [head]: value };
  const child = isRecord(target[head]) ? target[head] : {};
  return { ...target, [head]: withNestedValue(child, rest, value) };
}

/**
 * הערך של שורה חדשה: כל שדה בשורה עם ערך ריק לפי הסוג שלו. גם לרשימה שכבר
 * הותאמה לשורה ("previousPartners.0.children") - לפי השמות המקוריים
 */
export function createRepeaterTemplate(
  repeater: FieldMetadata,
): Record<string, unknown> {
  const arrayName: string = repeater.originalName ?? repeater.name;
  return childFields(repeater).reduce<Record<string, unknown>>(
    (template, innerField) => {
      const relativePath = getRelativePath(
        innerField.originalName ?? innerField.name,
        arrayName,
      );
      if (!relativePath) return template;
      return withNestedValue(
        template,
        relativePath.split("."),
        getDefaultValueForField(innerField),
      );
    },
    {},
  );
}
