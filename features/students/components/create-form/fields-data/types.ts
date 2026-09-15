import type { FieldWidth } from "../field-layout";
import type { FieldCondition } from "../field-visibility";

// מבנה ההגדרות של טופס המיועדים: שלבים → מקטעים → שדות

export const TEXT_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "textarea",
  "switch",
] as const;

const SELECT_FIELD_TYPES = [
  "select",
  "select2",
  "chips",
  "chip",
  "inputAndSelect",
  "checkbox",
  "radio",
] as const;

const TEXT_SELECT_FIELD_TYPES = ["textAndSelect"] as const;

const RANGE_FIELD_TYPES = ["range", "rangeDouble"] as const;

const UPLOAD_FIELD_TYPES = ["upload"] as const;

const PHOTO_GALLERY_FIELD_TYPES = ["photos"] as const;

const REPEATER_FIELD_TYPES = ["repeater"] as const;

type Condition = FieldCondition;

export interface FieldOptionDefinition {
  value: string;
  /** ניסוח ברירת מחדל, כשעדיין לא נבחר מגדר */
  label: string;
  /** נוסח זכר — גובר על label כשנבחר "מיועד" */
  labelMale?: string;
  /** נוסח נקבה — גובר על label כשנבחר "מיועדת" */
  labelFemale?: string;
}

interface BaseField {
  name: string;
  id?: string;
  label: string;
  /** מינימום לשדות מספריים */
  min?: number;
  /** מקסימום לשדות מספריים */
  max?: number;
  placeholder?: string;
  description?: string;
  beforeField?: string;
  /**
   * שדה חובה: מציג כוכבית אדומה ונאכף במעבר שלב ובשליחה (required-fields.ts).
   * נאכף רק כשהשדה מוצג, וגם בתוך שורות של רשומה חוזרת.
   * שם עם תוארים: חובה = השם עצמו. קובץ / תמונות: קובץ שכבר שמור נחשב מולא.
   */
  required?: boolean;
  /** הודעה משלו לשדה חובה ריק. בלי זה: "נא למלא/לבחור <תווית>" (field-messages.ts) */
  requiredMessage?: string;
  value?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange?: (e?: any) => void;
  className?: string;
  /** רוחב סמנטי - ממופה לרשת ב-field-layout.ts. בלי width: שורה מלאה */
  width?: FieldWidth;
  condition?: Condition[];
}

export interface TextField extends BaseField {
  type: (typeof TEXT_FIELD_TYPES)[number];
}

export interface SelectField extends BaseField {
  type: (typeof SELECT_FIELD_TYPES)[number];
  options: FieldOptionDefinition[];
  empty?: string;
  vertical?: boolean;
  endpoint?: string;
  table?: string;
  valueColumn?: string;
  labelColumn?: string;
  searchColumn?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  /**
   * select2 בתוך שורה של רשומה חוזרת: בבחירה ממלא שדות אחים באותה שורה
   * מעמודות הטבלה. { <שם השדה בשורה>: <עמודה> }, למשל { name: "name" }
   */
  fillOnSelect?: Record<string, string>;
}

export interface TextAndSelectField extends BaseField {
  type: (typeof TEXT_SELECT_FIELD_TYPES)[number];
  options: {
    value: string;
    label: string;
  }[];
  prefixOptions?: {
    value: string;
    label: string;
  }[];
  prefixPlaceholder?: string;
  empty?: string;
  vertical?: boolean;
}

export interface RangeField extends BaseField {
  type: (typeof RANGE_FIELD_TYPES)[number];
}

export interface UploadField extends BaseField {
  type: (typeof UPLOAD_FIELD_TYPES)[number];
  accept?: { [key: string]: string[] } | undefined;
  multiple?: boolean;
  maxFiles?: number;
  /** בעריכה, כשכבר שמור קובץ (existingUrl): הכותרת שלו. ברירת מחדל: "קובץ שמור" */
  storedFileLabel?: string;
}

/** גלריית תמונות מסודרת (StudentPhotoItem[]); הראשונה היא הראשית */
export interface PhotoGalleryField extends BaseField {
  type: (typeof PHOTO_GALLERY_FIELD_TYPES)[number];
}

export interface RepeaterField {
  type: (typeof REPEATER_FIELD_TYPES)[number];
  name: string;
  /** השדות של כל שורה. השמות מתחת לשם הרשומה: "family.mechutanim.firstName" */
  fields: Field[];
  condition?: Condition[];
  /**
   * לפחות שורה אחת. בלי זה רשומה ריקה תקינה, ושדות חובה בתוך השורות נאכפים
   * רק בשורות שנוספו
   */
  required?: boolean;
  requiredMessage?: string;
  /** טקסט כפתור ההוספה, למשל "הוספת מחותן". ברירת מחדל: "הוספת רשומה" */
  addLabel?: string;
  /** כותרת של כל רשומה, עם מספר: "מחותן 1". ברירת מחדל: "רשומה" */
  itemLabel?: string;
  /** שורה כשאין רשומות. ברירת מחדל: "אין רשומות עדיין." */
  emptyText?: string;
}

export type Field =
  | TextField
  | SelectField
  | TextAndSelectField
  | RangeField
  | UploadField
  | PhotoGalleryField
  | RepeaterField;

export type FormSection = {
  name: string;
  title: string;
  fields: Field[];
  condition?: Condition[];
};

export type FormSteps = {
  name: string;
  title: string;
  sections: FormSection[];
};

export function isTextFieldType(type: unknown): type is TextField["type"] {
  return TEXT_FIELD_TYPES.includes(type as TextField["type"]);
}

export function isSelectFieldType(type: unknown): type is SelectField["type"] {
  return SELECT_FIELD_TYPES.includes(type as SelectField["type"]);
}

export function isTextAndSelectFieldType(
  type: unknown,
): type is TextAndSelectField["type"] {
  return TEXT_SELECT_FIELD_TYPES.includes(type as TextAndSelectField["type"]);
}

export function isRangeFieldType(type: unknown): type is RangeField["type"] {
  return RANGE_FIELD_TYPES.includes(type as RangeField["type"]);
}

export function isUploadFieldType(type: unknown): type is UploadField["type"] {
  return UPLOAD_FIELD_TYPES.includes(type as UploadField["type"]);
}

export function isPhotoGalleryFieldType(
  type: unknown,
): type is PhotoGalleryField["type"] {
  return PHOTO_GALLERY_FIELD_TYPES.includes(type as PhotoGalleryField["type"]);
}
