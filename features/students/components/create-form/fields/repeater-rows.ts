import {
  resolveRepeaterPath,
  resolveRowConditions,
} from "../field-visibility";
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

/** הגדרת שדה בשורה מסוימת: השם והתנאים לפי השורה, והקישור לבורר המאגר */
export function toRowFieldConfig(
  innerField: FieldMetadata,
  repeater: FieldMetadata,
  index: number,
  idFieldPaths: ReadonlySet<string>,
): FieldMetadata {
  const resolvedName = resolveRepeaterPath(
    innerField.name,
    repeater.name,
    index,
  );
  return {
    ...innerField,
    name: resolvedName,
    condition: resolveRowConditions(innerField.condition, repeater.name, index),
    originalName: innerField.originalName ?? innerField.name,
    isIdField: idFieldPaths.has(resolvedName),
    linkedIdPath: determineLinkedIdPath(resolvedName, idFieldPaths),
  };
}

function getDefaultValueForField(field: FieldMetadata): unknown {
  switch (field.type) {
    case "chip":
    case "chips":
    case "checkbox":
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

/** הערך של שורה חדשה: כל שדה בשורה עם ערך ריק לפי הסוג שלו */
export function createRepeaterTemplate(
  repeater: FieldMetadata,
): Record<string, unknown> {
  return childFields(repeater).reduce<Record<string, unknown>>(
    (template, innerField) => {
      const relativePath = getRelativePath(
        innerField.originalName ?? innerField.name,
        repeater.name,
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
