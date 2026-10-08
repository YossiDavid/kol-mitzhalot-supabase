import type { FieldWidth } from "../field-layout";
import type { FieldCondition } from "../field-visibility";

// מבנה ההגדרות של טופס המיועדים: שלבים → מקטעים → שדות

type TextFieldType = "text" | "number" | "date" | "textarea" | "switch";

type SelectFieldType =
  | "select"
  | "select2"
  | "chips"
  | "chip"
  | "inputAndSelect"
  | "checkbox"
  | "radio";

type TextAndSelectFieldType = "textAndSelect";

type RangeFieldType = "range" | "rangeDouble";

type UploadFieldType = "upload";

type PhotoGalleryFieldType = "photos";

type RepeaterFieldType = "repeater";

type ChildrenListFieldType = "childrenList";

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
   * טקסט פתיח עם חלק מתקפל (HTML): lead תמיד מוצג, more מתקפל מאחורי "קראו
   * עוד", ו-tail (הנחיות וחובות) תמיד מוצג אחרי החלק המתקפל. גובר על beforeField.
   */
  beforeFieldCollapsible?: { lead: string; more: string; tail: string };
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
  /**
   * שדה מושבת: ההגדרה נשמרת בנתונים לשימוש עתידי, אבל השדה לא מוצג ולא
   * נחשב בורר שנועל את השורה. להפעלה - מוחקים את הדגל.
   */
  hidden?: boolean;
}

export interface TextField extends BaseField {
  type: TextFieldType;
}

export interface SelectField extends BaseField {
  type: SelectFieldType;
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
  /**
   * select2 מול מאגר טקסטואלי: ערך שאינו ברשימה מוצע להוספה למאגר
   * ("הוספה למאגר"), ואז נבחר. דורש table שבו הערך הוא עמודת השם.
   */
  creatable?: boolean;
}

export interface TextAndSelectField extends BaseField {
  type: TextAndSelectFieldType;
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
  type: RangeFieldType;
}

export interface UploadField extends BaseField {
  type: UploadFieldType;
  accept?: { [key: string]: string[] } | undefined;
  multiple?: boolean;
  maxFiles?: number;
  /** בעריכה, כשכבר שמור קובץ (existingUrl): הכותרת שלו. ברירת מחדל: "קובץ שמור" */
  storedFileLabel?: string;
}

/** גלריית תמונות מסודרת (StudentPhotoItem[]); הראשונה היא הראשית */
export interface PhotoGalleryField extends BaseField {
  type: PhotoGalleryFieldType;
}

export interface RepeaterField {
  type: RepeaterFieldType;
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

/**
 * רשימה בתוך שורה של רשומה חוזרת, בשורה צפופה לכל פריט (ילדים מנישואים
 * קודמים, children-list-field.tsx). השמות מתחת לשם הרשימה:
 * "previousPartners.children.birthDate". שדות חובה נאכפים בכל פריט קיים.
 */
export interface ChildrenListField {
  type: ChildrenListFieldType;
  name: string;
  /** כותרת הרשימה. המספר שנגזר מהרשימה נוסף אחריה: "ילדים מנישואין אלו (2)" */
  label: string;
  fields: Field[];
  condition?: Condition[];
  /** לפחות פריט אחד (כמו ברשומה חוזרת) */
  required?: boolean;
  requiredMessage?: string;
  addLabel?: string;
  /** שם של פריט, עם מספר: "ילד/ה 1" (תווית הפריט וכפתור המחיקה) */
  itemLabel?: string;
  emptyText?: string;
}

/** שדה שמכיל שורות של שדות: רשומה חוזרת או רשימה בתוך שורה */
export type ListField = RepeaterField | ChildrenListField;

export type Field =
  | TextField
  | SelectField
  | TextAndSelectField
  | RangeField
  | UploadField
  | PhotoGalleryField
  | RepeaterField
  | ChildrenListField;

export function isListField(field: Field): field is ListField {
  return field.type === "repeater" || field.type === "childrenList";
}

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
