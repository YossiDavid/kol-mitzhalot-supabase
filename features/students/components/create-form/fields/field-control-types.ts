import type { Control } from "react-hook-form";

export type FieldGender = "male" | "female" | "";

/** הגדרת שדה מ-fields-data. בשורה של רשומה חוזרת - עם השם של השורה */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FieldMetadata = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyFormControl = Control<any>;

export type GetFieldLabel = (
  field: FieldMetadata,
  gender: FieldGender,
) => string;

export interface FieldOption {
  value: string;
  label: string;
}

/**
 * מה שהשדה ורשומה חוזרת מקבלים מהאשף. אין כאן את ערכי הטופס: כל שדה צופה
 * רק במה שהוא צריך (use-form-conditions.ts)
 */
export interface DynamicFieldProps {
  field: FieldMetadata;
  control: AnyFormControl;
  gender: FieldGender;
  getLabel: GetFieldLabel;
}

/** מה שהמפצל (atomic-field.tsx) מעביר לכל רכיב של סוג שדה */
export interface FieldControlProps {
  field: FieldMetadata;
  control: AnyFormControl;
  name: string;
  /** id יציב לפקד הראשי: "father.self" → "father-self" */
  fieldId: string;
  label: string;
  isRequired: boolean;
  /** נעול: באותה שורה נבחרה רשומה מתוך המאגר */
  isDisabled: boolean;
  placeholder?: string;
  description?: string;
  /** האפשרויות, עם הנוסח המגדרי כבר פתור */
  options: FieldOption[];
  /** הודעת שדה חובה כללית → משפט עם התווית (field-messages.ts) */
  formatMessage: (message: string) => string;
}
