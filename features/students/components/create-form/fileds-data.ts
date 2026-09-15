"use client";

import {
  MAX_STUDENT_PHOTOS,
  MAX_STUDENT_PHOTO_MB,
} from "@/features/students/lib/student-photo-rules";
import type { FieldWidth } from "./field-layout";
import type { FieldCondition } from "./field-visibility";

// Variables
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

// Types
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
  options: {
    value: string;
    /** ניסוח ברירת מחדל, כשעדיין לא נבחר מגדר */
    label: string;
    /** נוסח זכר — גובר על label כשנבחר "מיועד" */
    labelMale?: string;
    /** נוסח נקבה — גובר על label כשנבחר "מיועדת" */
    labelFemale?: string;
  }[];
  empty?: string;
  vertical?: boolean;
  endpoint?: string;
  table?: string;
  valueColumn?: string;
  labelColumn?: string;
  searchColumn?: string;
  filters?: Record<string, any>;
  params?: Record<string, any>;
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
}

/** גלריית תמונות מסודרת (StudentPhotoItem[]); הראשונה היא הראשית */
export interface PhotoGalleryField extends BaseField {
  type: (typeof PHOTO_GALLERY_FIELD_TYPES)[number];
}

export interface RepeaterField {
  type: (typeof REPEATER_FIELD_TYPES)[number];
  name: string;
  fileds: Field[];
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

type FormSection = {
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

// Functions
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

// Data
export const studentFields: FormSteps[] = [
  {
    name: "intro",
    title: "הקדמה",
    sections: [
      {
        name: "intro",
        title: "",
        fields: [
          {
            name: "gender",
            width: "full",
            label: "אני ממלא/ת את טופס הקו״ח עבור:",
            type: "radio",
            options: [
              { value: "male", label: "מיועד" },
              { value: "female", label: "מיועדת" },
            ],
            required: true,
            // התווית היא משפט שלם, ולכן הודעה מפורשת
            requiredMessage: "נא לבחור מיועד/מיועדת",
            beforeField:
              "<h3>ברוכים הבאים למערכת השידוכים שלנו</h3><p>תודה על הצטרפותכם.</p><p>על מנת שנוכל להכיר אתכם לעומק ולהציע הצעות שידוך מותאמות ומדויקות – יש למלא את הטופס שלפניכם במלואו ובאופן מדויק.</p><p><b>המידע שתמלאו ישמר בפרטיות מוחלטת וישמש אך ורק לצורכי תהליך ההתאמה.</b></p><p>נודה על שיתוף פעולה מלא ומוקפד – זהו שלב חיוני להצלחת התהליך.</p><hr/>",
          },
        ],
      },
    ],
  },
  {
    name: "basicInformation",
    title: "פרטים אישיים",
    sections: [
      {
        name: "basicInformation",
        title: "",
        fields: [
          {
            name: "firstName",
            width: "sm",
            label: "שם פרטי",
            type: "text",
            required: true,
          },
          {
            name: "lastName",
            width: "sm",
            label: "שם משפחה",
            type: "text",
            required: true,
          },
          {
            name: "identityNumber",
            width: "sm",
            label: "תעודת זהות",
            type: "text",
            required: true,
          },
          {
            name: "birthDate",
            width: "sm",
            label: "תאריך לידה",
            type: "date",
            required: true,
          },
          {
            name: "photos",
            width: "full",
            label: "תמונות",
            type: "photos",
            description: `עד ${MAX_STUDENT_PHOTOS} תמונות (JPG, PNG או WebP). תמונות גדולות מוקטנות אוטומטית לעד ${MAX_STUDENT_PHOTO_MB}MB. התמונה הראשונה היא התמונה הראשית. התמונות יישלחו לצד השני רק לאחר הסכמתכם.`,
            // לא חובה בכוונה: כרטיס קיים בלי תמונות חייב להמשיך להישמר.
            // עם required: true - לפחות תמונה אחת; תמונה שמורה נחשבת
          },
          {
            name: "country",
            width: "sm",
            label: "ארץ",
            type: "text",
            required: true,
          },
          {
            name: "city",
            width: "sm",
            label: "עיר",
            type: "text",
            required: true,
          },
          {
            name: "street",
            width: "sm",
            label: "רחוב",
            type: "text",
            required: true,
          },
          {
            name: "house",
            width: "sm",
            label: "מספר בית",
            type: "text",
            required: true,
          },
          {
            name: "community",
            width: "sm",
            label: "חסידות או קהילה",
            type: "text",
          },
          {
            name: "shtible",
            width: "sm",
            label: "שם השטיבל",
            type: "text",
          },
          {
            name: "personalStatus",
            width: "sm",
            label: "סטטוס אישי",
            type: "select",
            options: [
              {
                value: "single",
                label: "רווק.ה",
                labelMale: "רווק",
                labelFemale: "רווקה",
              },
              {
                value: "divorced",
                label: "גרוש.ה",
                labelMale: "גרוש",
                labelFemale: "גרושה",
              },
              {
                value: "widowed",
                label: "אלמנ.ה",
                labelMale: "אלמן",
                labelFemale: "אלמנה",
              },
            ],
            required: true,
          },
          {
            name: "height",
            width: "sm",
            label: "גובה (בס״מ)",
            type: "number",
            min: 50,
            placeholder: "לדוגמה: 175",
          },
          {
            name: "cellphoneType",
            width: "sm",
            label: "סוג טלפון נייד",
            type: "select",
            vertical: true,
            options: [
              {
                value: "kosher",
                label: "כשר",
              },
              {
                value: "sms",
                label: "SMS",
              },
              {
                value: "protected_smartphone",
                label: "סמארטפון מוגן",
              },
              {
                value: "other",
                label: "אחר",
              },
            ],
            required: true,
          },
          {
            name: "phone",
            width: "sm",
            label: "מספר טלפון של המיועד.ת",
            type: "text",
          },
          {
            name: "institutionId",
            width: "sm",
            label: "מוסד לימודים נוכחי",
            type: "select2",
            placeholder: "חיפוש מוסד לימודים...",
            empty: "לא נמצאו מוסדות",
            options: [],
            table: "institutions",
            valueColumn: "id",
            labelColumn: "name",
            searchColumn: "name",
            filters: { gender: "male", is_active: true },
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "male",
              },
            ],
          },
          {
            name: "institutionId",
            width: "sm",
            label: "מוסד לימודים נוכחי",
            type: "select2",
            placeholder: "חיפוש מוסד לימודים...",
            empty: "לא נמצאו מוסדות",
            options: [],
            table: "institutions",
            valueColumn: "id",
            labelColumn: "name",
            searchColumn: "name",
            filters: { gender: "female", is_active: true },
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "female",
              },
            ],
          },
          {
            name: "planForLife",
            width: "sm",
            label: "מתעתד בעז״ה:",
            type: "select",
            vertical: true,
            options: [
              {
                value: "koilel",
                label: "ללמוד בכולל",
              },
              {
                value: "torah_job",
                label: "לעבוד בעבודה תורנית",
              },
              {
                value: "mix_torah_work",
                label: "לשלב תורה ועבודה",
              },
              {
                value: "work",
                label: "לעבוד",
              },
            ],
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "male",
              },
            ],
          },
          {
            name: "headCoverType",
            width: "sm",
            label: "סוג כיסוי ראש נהוג",
            type: "select",
            vertical: true,
            options: [
              {
                value: "kerchief",
                label: "מטפחת",
              },
              {
                value: "wig",
                label: "פאה",
              },
              {
                value: "kerchief_on_wig",
                label: "מטפחת על פאה",
              },
              {
                value: "other",
                label: "לא משנה",
              },
            ],
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "female",
              },
            ],
          },
          {
            name: "about",
            width: "full",
            label: "כמה מילים על אופי וסגנון המיועד.ת",
            type: "textarea",
          },
          {
            name: "cv",
            width: "full",
            label: "הוספת קובץ קורות חיים",
            type: "upload",
            multiple: false,
            description: "המסמך יישלח לצד השני רק לאחר הסכמתכם",
            accept: {
              "application/pdf": [".pdf"],
              "image/*": [".png", ".jpg", ".jpeg"],
            },
          },
        ],
      },
    ],
  },
  {
    name: "familyInfoForm",
    title: "על המשפחה",
    sections: [
      {
        name: "aboutFather",
        title: "על האב",
        fields: [
          {
            name: "father.self",
            label: "שם האב",
            type: "textAndSelect",
            prefixOptions: [
              { value: "הרב", label: "הרב" },
              { value: "הר״ר", label: "הר״ר" },
              { value: "הרה״ח", label: "הרה״ח" },
              { value: "הרה״ג", label: "הרה״ג" },
              { value: "הרה״צ", label: "הרה״צ" },
            ],
            prefixPlaceholder: "תואר לפני",
            placeholder: "תואר אחרי",
            options: [
              { value: "הי״ו", label: "הי״ו" },
              { value: "שליט״א", label: "שליט״א" },
              { value: "ז״ל", label: "ז״ל" },
              { value: "זצ״ל", label: "זצ״ל" },
              { value: "זצוק״ל", label: "זצוק״ל" },
            ],
            required: true,
            width: "lg",
          },
          {
            name: "father.phone",
            label: "טלפון",
            type: "text",
            width: "sm",
            required: true,
          },
          {
            name: "father.job",
            label: "עיסוק",
            type: "text",
            width: "sm",
            required: true,
          },
          {
            name: "father.grandFather",
            label: "שם אביו",
            type: "textAndSelect",
            prefixOptions: [
              { value: "הרב", label: "הרב" },
              { value: "הר״ר", label: "הר״ר" },
              { value: "הרה״ח", label: "הרה״ח" },
              { value: "הרה״ג", label: "הרה״ג" },
              { value: "הרה״צ", label: "הרה״צ" },
            ],
            prefixPlaceholder: "תואר לפני",
            placeholder: "תואר אחרי",
            options: [
              { value: "הי״ו", label: "הי״ו" },
              { value: "שליט״א", label: "שליט״א" },
              { value: "ז״ל", label: "ז״ל" },
              { value: "זצ״ל", label: "זצ״ל" },
              { value: "זצוק״ל", label: "זצוק״ל" },
            ],
            required: true,
            width: "lg",
          },
          {
            name: "father.grandMother",
            label: "שם אמו",
            type: "textAndSelect",
            prefixOptions: [
              { value: "הגב׳", label: "הגב׳" },
              { value: "הרבנית", label: "הרבנית" },
            ],
            prefixPlaceholder: "תואר לפני",
            placeholder: "תואר אחרי",
            options: [
              { value: "תחי׳", label: "תחי׳" },
              { value: "תליט״א", label: "תליט״א" },
              { value: "ע״ה", label: "ע״ה" },
            ],
            required: true,
            width: "lg",
          },
          {
            // בסוף המקטע ולא ליד השם: שדה רגיל, ובשורה של השם עם התוארים
            // לא נשאר לו מקום
            name: "father.email",
            label: "אימייל",
            type: "text",
            width: "lg",
          },
        ],
      },
      {
        name: "aboutMother",
        title: "על האם",
        fields: [
          {
            name: "mother.self",
            label: "שם האם",
            type: "textAndSelect",
            prefixOptions: [
              { value: "הגב׳", label: "הגב׳" },
              { value: "הרבנית", label: "הרבנית" },
            ],
            prefixPlaceholder: "תואר לפני",
            placeholder: "תואר אחרי",
            options: [
              { value: "תחי׳", label: "תחי׳" },
              { value: "תליט״א", label: "תליט״א" },
              { value: "ע״ה", label: "ע״ה" },
            ],
            required: true,
            width: "lg",
          },
          {
            name: "mother.phone",
            label: "טלפון",
            type: "text",
            width: "sm",
            required: true,
          },
          {
            name: "mother.job",
            label: "עיסוק",
            type: "text",
            width: "sm",
            required: true,
          },
          {
            name: "mother.grandFather",
            label: "שם אביה",
            type: "textAndSelect",
            prefixOptions: [
              { value: "הרב", label: "הרב" },
              { value: "הר״ר", label: "הר״ר" },
              { value: "הרה״ח", label: "הרה״ח" },
              { value: "הרה״ג", label: "הרה״ג" },
              { value: "הרה״צ", label: "הרה״צ" },
            ],
            prefixPlaceholder: "תואר לפני",
            placeholder: "תואר אחרי",
            options: [
              { value: "הי״ו", label: "הי״ו" },
              { value: "שליט״א", label: "שליט״א" },
              { value: "ז״ל", label: "ז״ל" },
              { value: "זצ״ל", label: "זצ״ל" },
              { value: "זצוק״ל", label: "זצוק״ל" },
            ],
            required: true,
            width: "lg",
          },
          {
            name: "mother.grandMother",
            label: "שם אימה",
            type: "textAndSelect",
            prefixOptions: [
              { value: "הגב׳", label: "הגב׳" },
              { value: "הרבנית", label: "הרבנית" },
            ],
            prefixPlaceholder: "תואר לפני",
            placeholder: "תואר אחרי",
            options: [
              { value: "תחי׳", label: "תחי׳" },
              { value: "תליט״א", label: "תליט״א" },
              { value: "ע״ה", label: "ע״ה" },
            ],
            required: true,
            width: "lg",
          },
          {
            // ליד אימייל ולא ב-2 עמודות: התווית נשברה והשדה נמעך
            name: "mother.maidenName",
            label: "שם נעורים",
            type: "text",
            width: "lg",
            required: true,
          },
          {
            name: "mother.email",
            label: "אימייל",
            type: "text",
            width: "lg",
          },
        ],
      },
      {
        name: "aboutTheBrothers",
        title: "על האחים",
        fields: [
          {
            name: "family.numberOfChildren",
            type: "number",
            label: "מספר ילדים במשפחה",
            required: true,
            width: "sm",
          },
          {
            name: "family.currentChildPlace",
            type: "number",
            label: "מיקום הילד בין האחים",
            required: true,
            width: "sm",
          },
          {
            name: "family.about",
            type: "textarea",
            label: "כמה מילים על סגנון המשפחה",
            required: true,
            width: "full",
          },
        ],
      },
      {
        name: "aboutTheMechutanim",
        title: "מחותנים",
        fields: [
          {
            name: "family.mechutanim",
            type: "repeater",
            addLabel: "הוספת מחותן",
            itemLabel: "מחותן",
            emptyText: "עדיין לא נוספו מחותנים.",
            fileds: [
              {
                name: "family.mechutanim.id",
                type: "select2",
                placeholder: "חיפוש במאגר",
                label: "לבחירה מתוך המאגר",
                options: [],
                endpoint: "/users/mechutanim",
                width: "sm",
              },
              {
                name: "family.mechutanim.firstName",
                type: "text",
                label: "שם פרטי",
                width: "sm",
              },
              {
                name: "family.mechutanim.lastName",
                type: "text",
                label: "שם משפחה",
                width: "sm",
              },
              {
                name: "family.mechutanim.city",
                type: "text",
                label: "עיר",
                width: "sm",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "education",
    title: "פרטים נוספים",
    sections: [
      {
        name: "educationYeshivaKtana",
        title: "ישיבה קטנה",
        fields: [
          {
            type: "repeater",
            name: "education.yeshivaKtana",
            addLabel: "הוספת ישיבה קטנה",
            itemLabel: "ישיבה קטנה",
            emptyText: "עדיין לא נוספו ישיבות קטנות.",
            fileds: [
              {
                name: "education.yeshivaKtana.id",
                width: "sm",
                label: "לבחירה מתוך המאגר",
                type: "select2",
                options: [{ value: "", label: "" }],
                endpoint: "/educational-institutions/yeshiva-ktana",
              },
              {
                name: "education.yeshivaKtana.name",
                width: "sm",
                label: "שם הישיבה",
                type: "text",
              },
              {
                name: "education.yeshivaKtana.community",
                width: "sm",
                label: "קהילה / חסידות",
                type: "text",
              },
              {
                name: "education.yeshivaKtana.city",
                width: "sm",
                label: "עיר",
                type: "text",
              },
            ],
          },
        ],
        condition: [
          {
            parameter: "gender",
            operator: "===",
            value: "male",
          },
        ],
      },
      {
        name: "educationYeshivaGdola",
        title: "ישיבה גדולה",
        fields: [
          {
            type: "repeater",
            name: "education.yeshivaGdola",
            addLabel: "הוספת ישיבה גדולה",
            itemLabel: "ישיבה גדולה",
            emptyText: "עדיין לא נוספו ישיבות גדולות.",
            fileds: [
              {
                name: "education.yeshivaGdola.id",
                width: "sm",
                label: "לבחירה מתוך המאגר",
                type: "select2",
                options: [{ value: "", label: "" }],
                endpoint: "/educational-institutions/yeshiva-gdola",
              },
              {
                name: "education.yeshivaGdola.name",
                width: "sm",
                label: "שם הישיבה",
                type: "text",
              },
              {
                name: "education.yeshivaGdola.community",
                width: "sm",
                label: "קהילה / חסידות",
                type: "text",
              },
              {
                name: "education.yeshivaGdola.city",
                width: "sm",
                label: "עיר",
                type: "text",
              },
            ],
          },
        ],
        condition: [
          {
            parameter: "gender",
            operator: "===",
            value: "male",
          },
        ],
      },
      {
        name: "educationKolel",
        title: "כולל",
        fields: [
          {
            type: "repeater",
            name: "education.kolel",
            addLabel: "הוספת כולל",
            itemLabel: "כולל",
            emptyText: "עדיין לא נוספו כוללים.",
            fileds: [
              {
                name: "education.kolel.id",
                width: "sm",
                label: "לבחירה מתוך המאגר",
                type: "select2",
                options: [{ value: "", label: "" }],
                endpoint: "/educational-institutions/kolel",
              },
              {
                name: "education.kolel.name",
                width: "sm",
                label: "שם הכולל",
                type: "text",
              },
              {
                name: "education.kolel.community",
                width: "sm",
                label: "קהילה / חסידות",
                type: "text",
              },
              {
                name: "education.kolel.city",
                width: "sm",
                label: "עיר",
                type: "text",
              },
            ],
          },
        ],
        condition: [
          {
            parameter: "personalStatus",
            operator: "!==",
            value: "single",
          },
          {
            parameter: "gender",
            operator: "===",
            value: "male",
          },
        ],
      },
      {
        name: "educationSeminar",
        title: "סמינר",
        fields: [
          {
            type: "repeater",
            name: "education.seminar",
            addLabel: "הוספת סמינר",
            itemLabel: "סמינר",
            emptyText: "עדיין לא נוספו סמינרים.",
            fileds: [
              {
                name: "education.seminar.id",
                width: "sm",
                label: "לבחירה מתוך המאגר",
                type: "select2",
                options: [{ value: "", label: "" }],
                endpoint: "/educational-institutions/seminar",
              },
              {
                name: "education.seminar.name",
                width: "sm",
                label: "שם הסמינר",
                type: "text",
              },
              {
                name: "education.seminar.community",
                width: "sm",
                label: "קהילה / חסידות",
                type: "text",
              },
              {
                name: "education.seminar.city",
                width: "sm",
                label: "עיר",
                type: "text",
              },
            ],
          },
        ],
        condition: [
          {
            parameter: "gender",
            operator: "===",
            value: "female",
          },
        ],
      },
      {
        name: "employment",
        title: "תעסוקה",
        fields: [
          {
            name: "employment.tags",
            width: "full",
            label: "מה עושה כיום?",
            type: "chips",
            options: [
              { label: "לומד בישיבה", value: "yeshiva" },
              { label: "אברך כולל", value: "kolel" },
              { label: "לומד עם חברותא", value: "havruta" },
              { label: "עובד", value: "working" },
              { label: "לומד מקצוע", value: "profession" },
            ],
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "male",
              },
            ],
          },

          {
            name: "employment.tags",
            width: "full",
            label: "מה עושה כיום?",
            type: "chips",
            options: [
              { label: "תלמידת סמינר", value: "seminar" },
              { label: "עובדת", value: "working" },
              {
                value: "profession",
                label: "לומדת מקצוע",
              },
              { label: "בבית", value: "at_home" },
            ],
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "female",
              },
            ],
          },
          {
            name: "employment.yeshiva",
            width: "lg",
            label: "איפה?",
            type: "text",
            beforeField: "לומד בישיבה",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "yeshiva",
              },
            ],
          },
          {
            name: "employment.kolel",
            width: "lg",
            label: "איפה?",
            type: "text",
            beforeField: "אברך כולל",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "kolel",
              },
            ],
          },
          {
            name: "employment.havruta.with",
            width: "lg",
            label: "עם מי?",
            type: "text",
            beforeField: "לומד עם חברותא",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "havruta",
              },
            ],
          },
          {
            name: "employment.havruta.where",
            width: "lg",
            label: "איפה?",
            type: "text",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "havruta",
              },
            ],
          },
          {
            name: "employment.seminar",
            width: "lg",
            label: "איפה?",
            type: "text",
            beforeField: "תלמידת סמינר",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "seminar",
              },
            ],
          },
          {
            name: "employment.working.role",
            width: "lg",
            label: "תפקיד?",
            type: "text",
            beforeField: "עבודה",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "working",
              },
            ],
          },
          {
            name: "employment.working.where",
            width: "lg",
            label: "איפה?",
            type: "text",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "working",
              },
            ],
          },
          {
            name: "employment.profession.what",
            width: "lg",
            label: "מה?",
            type: "text",
            beforeField: "לומד/ת מקצוע",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "profession",
              },
            ],
          },
          {
            name: "employment.profession.where",
            width: "lg",
            label: "איפה?",
            type: "text",
            condition: [
              {
                parameter: "employment.tags",
                operator: "includes",
                value: "profession",
              },
            ],
          },
        ],
      },
      {
        name: "previousPartners",
        title: "פרטי בן/בת זוג קודם/ת",
        condition: [
          {
            parameter: "personalStatus",
            operator: "!==",
            value: "single",
          },
        ],
        fields: [
          {
            type: "repeater",
            name: "previousPartners",
            addLabel: "הוספת נישואים קודמים",
            itemLabel: "נישואים קודמים",
            emptyText: "עדיין לא נוספו פרטי נישואים קודמים.",
            fileds: [
              {
                name: "previousPartners.separationType",
                width: "full",
                label: "אופן הפרידה",
                type: "radio",
                options: [
                  {
                    label: "גירושין",
                    value: "divorce",
                  },
                  { label: "פטירה", value: "death" },
                ],
              },
              {
                name: "previousPartners.fullName",
                width: "lg",
                label: "שם מלא של בן/בת הזוג הקודם/ה",
                type: "text",
              },
              {
                name: "previousPartners.parents.fathersName",
                width: "sm",
                label: "שם האב",
                type: "text",
              },
              {
                name: "previousPartners.parents.mothersName",
                width: "sm",
                label: "שם האם",
                type: "text",
              },
              {
                name: "previousPartners.parents.address",
                width: "lg",
                label: "כתובת ההורים",
                type: "text",
              },
              {
                name: "previousPartners.marriageDate",
                width: "sm",
                label: "תאריך נישואין",
                type: "date",
              },
              {
                name: "previousPartners.divorce.date",
                width: "sm",
                label: "תאריך גירושין",
                type: "date",
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "divorce",
                  },
                ],
              },
              {
                name: "previousPartners.deathDate",
                width: "sm",
                label: "תאריך פטירה",
                type: "date",
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "death",
                  },
                ],
              },
              {
                name: "previousPartners.childrenNumber",
                width: "sm",
                label: "מספר ילדים מנישואין אלו",
                type: "number",
              },
              {
                name: "previousPartners.marriedChildrenNumber",
                width: "sm",
                label: "מתוכם נשואים",
                type: "number",
              },
              {
                name: "previousPartners.divorce.rabbiName",
                width: "sm",
                label: "שם הרב המלווה בגירושין",
                type: "text",
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "divorce",
                  },
                ],
              },
              {
                name: "previousPartners.divorce.rabbiPhone",
                width: "sm",
                label: "טלפון של הרב",
                type: "text",
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "divorce",
                  },
                ],
              },
              {
                name: "previousPartners.divorce.reason",
                width: "full",
                label: "סיבת הגירושין",
                type: "textarea",
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "divorce",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "knownRabbanim",
        title: "רבנים מכירים",
        fields: [
          {
            type: "repeater",
            name: "knownRabbanim",
            addLabel: "הוספת רב מכיר",
            itemLabel: "רב מכיר",
            emptyText: "עדיין לא נוספו רבנים מכירים.",
            fileds: [
              {
                name: "knownRabbanim.name",
                width: "lg",
                type: "text",
                label: "שם מלא",
              },
              {
                name: "knownRabbanim.role",
                width: "sm",
                type: "text",
                label: "תפקיד",
              },
              {
                name: "knownRabbanim.phone",
                width: "sm",
                type: "text",
                label: "טלפון",
              },
              // {
              // 	name: "knownRabbanim.email",
              // 	type: "text",
              // 	label: "אימייל",
              // },
            ],
          },
        ],
      },
      {
        name: "knownFriends",
        title: "חברים מכירים",
        fields: [
          {
            type: "repeater",
            name: "knownFriends",
            addLabel: "הוספת חבר/ה",
            itemLabel: "חבר/ה",
            emptyText: "עדיין לא נוספו חברים מכירים.",
            fileds: [
              {
                name: "knownFriends.name",
                width: "lg",
                type: "text",
                label: "שם מלא",
              },
              {
                name: "knownFriends.phone",
                width: "sm",
                type: "text",
                label: "טלפון",
              },
              {
                name: "knownFriends.email",
                width: "sm",
                type: "text",
                label: "אימייל",
              },
            ],
          },
        ],
      },
      {
        name: "knownFamilyFriends",
        title: "מכרים משפחתיים",
        fields: [
          {
            type: "repeater",
            name: "knownFamilyFriends",
            addLabel: "הוספת מכר משפחתי",
            itemLabel: "מכר משפחתי",
            emptyText: "עדיין לא נוספו מכרים משפחתיים.",
            fileds: [
              {
                name: "knownFamilyFriends.name",
                width: "lg",
                type: "text",
                label: "שם מלא",
              },
              {
                name: "knownFamilyFriends.phone",
                width: "sm",
                type: "text",
                label: "טלפון",
              },
              {
                name: "knownFamilyFriends.email",
                width: "sm",
                type: "text",
                label: "אימייל",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "parentsStatus",
    title: "מצב ההורים",
    sections: [
      {
        name: "parentsStatus",
        title: "",
        fields: [
          {
            name: "parents.status",
            width: "lg",
            label: "סטטוס ההורים",
            type: "radio",
            options: [
              { value: "married", label: "נשואים" },
              { value: "divorced", label: "גרושים" },
              { value: "widowed", label: "אלמנ/ה" },
            ],
          },
          {
            name: "parents.holding",
            width: "lg",
            label: "מי ההורה שמגדל בפועל?",
            type: "radio",
            options: [
              { value: "mother", label: "האם" },
              { value: "father", label: "האב" },
              { value: "both", label: "שניהם" },
            ],
            condition: [
              {
                parameter: "parents.status",
                operator: "===",
                value: "divorced",
              },
            ],
          },
          {
            name: "parents.deadParent",
            width: "lg",
            label: "מי נפטר?",
            type: "radio",
            options: [
              { value: "mother", label: "האם" },
              { value: "father", label: "האב" },
              { value: "both", label: "שניהם" },
            ],
            condition: [
              {
                parameter: "parents.status",
                operator: "===",
                value: "widowed",
              },
            ],
          },
          {
            name: "parents.fatherDeathDate",
            width: "lg",
            label: "תאריך פטירת האב",
            type: "date",
            condition: [
              {
                parameter: "parents.status",
                operator: "===",
                value: "widowed",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "mother",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "mother",
              },
            ],
          },
          {
            name: "parents.motherDeathDate",
            width: "lg",
            label: "תאריך פטירת האם",
            type: "date",
            condition: [
              {
                parameter: "parents.status",
                operator: "===",
                value: "widowed",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "father",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "father",
              },
            ],
          },
          {
            name: "parents.isMotherRemarried",
            width: "lg",
            label: "האם האם נישאה מחדש?",
            type: "radio",
            options: [
              { value: "true", label: "כן" },
              { value: "false", label: "לא" },
            ],
            condition: [
              {
                parameter: "parents.status",
                operator: "!==",
                value: "married",
              },
              {
                parameter: "parents.status",
                operator: "!==",
                value: "",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "mother",
              },
              // {
              // 	parameter: "parents.deadParent",
              // 	operator: "!==",
              // 	value: "",
              // },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "both",
              },
            ],
          },
          {
            name: "parents.newHusbandName",
            width: "lg",
            label: "שם הבעל החדש",
            type: "text",
            condition: [
              {
                parameter: "parents.isMotherRemarried",
                operator: "===",
                value: "true",
              },
              // ההורים נשואים — אין בן/בת זוג חדש, גם אם נבחר קודם סטטוס אחר
              // והערך של הרדיו נשאר.
              {
                parameter: "parents.status",
                operator: "!==",
                value: "married",
              },
              {
                parameter: "parents.status",
                operator: "!==",
                value: "",
              },
              // הרדיו למעלה מוסתר כששני ההורים נפטרו, אך ערכו נשאר. בלי
              // השערים האלה השדה ממשיך להופיע אחרי שינוי deadParent.
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "both",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "mother",
              },
            ],
          },
          {
            name: "parents.isFatherRemarried",
            width: "lg",
            label: "האם האב נישא מחדש?",
            type: "radio",
            options: [
              { value: "true", label: "כן" },
              { value: "false", label: "לא" },
            ],
            condition: [
              {
                parameter: "parents.status",
                operator: "!==",
                value: "married",
              },
              {
                parameter: "parents.status",
                operator: "!==",
                value: "",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "father",
              },
              // {
              // 	parameter: "parents.deadParent",
              // 	operator: "!==",
              // 	value: "",
              // },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "both",
              },
            ],
          },
          {
            name: "parents.newWifeName",
            width: "lg",
            label: "שם האשה החדשה",
            type: "text",
            condition: [
              {
                parameter: "parents.isFatherRemarried",
                operator: "===",
                value: "true",
              },
              // ההורים נשואים — אין בן/בת זוג חדש, גם אם נבחר קודם סטטוס אחר
              // והערך של הרדיו נשאר.
              {
                parameter: "parents.status",
                operator: "!==",
                value: "married",
              },
              {
                parameter: "parents.status",
                operator: "!==",
                value: "",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "both",
              },
              {
                parameter: "parents.deadParent",
                operator: "!==",
                value: "father",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "medical",
    title: "פרטים רפואיים",
    sections: [
      {
        name: "medicalDetails",
        title: "",
        fields: [
          {
            name: "medical.status",
            width: "full",
            label: "מצב בריאותי כללי",
            type: "radio",
            options: [
              { value: "good", label: "תקין" },
              { value: "littleProblem", label: "בעיה קלה" },
              { value: "hugeProblem", label: "בעיה משמעותית" },
            ],
          },
          {
            name: "medical.exposureLevel",
            width: "full",
            label: "רמת חשיפה לבעיה",
            type: "radio",
            vertical: true,
            options: [
              {
                value: "no_exposure",
                label: "הסתרת עצם קיומה של הבעיה",
              },
              {
                value: "basic_exposure",
                label: "חשיפת רמת הבעיה בלבד עם פרטי יצירת קשר למידע נוסף",
              },
              {
                value: "only_for_kol_mitzhalot",
                label: "חשיפת פרטי הבעיה להנהלת קול מצהלות בלבד",
              },
              {
                value: "full_exposure",
                label: "חשיפת הבעיה ופרטיה לכלל השדכנים",
              },
            ],
            condition: [
              {
                parameter: "medical.status",
                operator: "in",
                value: ["littleProblem", "hugeProblem"],
              },
            ],
          },
          {
            name: "medical.details",
            width: "full",
            label: "פירוט הבעיה הרפואית",
            type: "textarea",
            condition: [
              {
                parameter: "medical.status",
                operator: "in",
                value: ["littleProblem", "hugeProblem"],
              },
            ],
          },
          {
            name: "medical.documents",
            width: "full",
            label: "העלאת מסמכים רפואיים",
            type: "upload",
            description:
              "גררו לכאן מסמכים רפואיים או בחרו מהמחשב (PDF / תמונה)",
            accept: {
              "application/pdf": [".pdf"],
              "image/*": [".png", ".jpg", ".jpeg"],
            },
            condition: [
              {
                parameter: "medical.status",
                operator: "in",
                value: ["littleProblem", "hugeProblem"],
              },
            ],
          },
          {
            name: "medical.contactForMoreInfo",
            width: "full",
            label: "עם מי לדבר על פרטים נוספים",
            type: "radio",
            options: [
              { value: "parents", label: "ההורים" },
              { value: "other_contact", label: "מישהו אחר" },
            ],
            condition: [
              {
                parameter: "medical.status",
                operator: "in",
                value: ["littleProblem", "hugeProblem"],
              },
            ],
          },
          {
            type: "repeater",
            name: "medical.otherContact",
            addLabel: "הוספת איש קשר",
            itemLabel: "איש קשר",
            emptyText: "עדיין לא נוסף איש קשר.",
            condition: [
              {
                parameter: "medical.contactForMoreInfo",
                operator: "===",
                value: "other_contact",
              },
            ],
            fileds: [
              {
                name: "medical.otherContact.name",
                width: "lg",
                label: "שם איש קשר",
                type: "text",
              },
              {
                name: "medical.otherContact.phone",
                width: "sm",
                label: "טלפון",
                type: "text",
              },
              {
                name: "medical.otherContact.email",
                width: "sm",
                label: "אימייל",
                type: "text",
              },
            ],
          },
          {
            name: "medical.relatedIssuePreference",
            width: "full",
            label: "האם מעוניינים בשידוך עם בעיה רפואית?",
            type: "radio",
            vertical: true,
            options: [
              {
                value: "same_issue",
                label: "עם בעיה רפואית זהה",
              },
              {
                value: "similar_or_other",
                label: "בעיה רפואית דומה או אחרת באותה רמה",
              },
              {
                value: "no_issue",
                label: "ללא בעיה רפואית",
              },
            ],
            condition: [
              {
                parameter: "medical.status",
                operator: "in",
                value: ["littleProblem", "hugeProblem"],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "partner",
    title: "קצת על סגנון השידוך",
    sections: [
      {
        name: "partnerPreferences",
        title: "",
        fields: [
          {
            name: "partner.ageRange",
            width: "lg",
            label: "טווח גילאים",
            type: "rangeDouble",
          },
          {
            name: "partner.preferredCountry",
            width: "lg",
            label: "ארץ מועדפת",
            type: "radio",
            options: [
              { value: "all", label: "אין העדפה" },
              { value: "specific", label: "מדינות מסוימות" },
            ],
          },
          {
            type: "repeater",
            name: "partner.specificCountries",
            addLabel: "הוספת מדינה",
            itemLabel: "מדינה",
            emptyText: "עדיין לא נוספו מדינות.",
            condition: [
              {
                parameter: "partner.preferredCountry",
                operator: "===",
                value: "specific",
              },
            ],
            fileds: [
              {
                name: "partner.specificCountries.name",
                width: "lg",
                label: "שם המדינה",
                type: "text",
              },
              {
                name: "partner.specificCountries.locale",
                width: "lg",
                label: "קוד מדינה (אופציונלי)",
                type: "text",
              },
            ],
          },
          // הסעיף מתאר את מי שמחפשים, ולכן המגדר הפוך לזה של הממלא/ת.
          // אוצר המילים זהה ל-employment.tags כדי לשמור על ניסוח אחיד.
          {
            name: "partner.workStatus",
            width: "full",
            label: "סטטוס תעסוקתי מבוקש",
            type: "chips",
            options: [
              { value: "student", label: "תלמידת סמינר" },
              { value: "working", label: "עובדת" },
              { value: "profession_student", label: "לומדת מקצוע" },
              { value: "at_home", label: "בבית" },
              { value: "other", label: "לא משנה" },
            ],
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "male",
              },
            ],
          },
          {
            name: "partner.workStatus",
            width: "full",
            label: "סטטוס תעסוקתי מבוקש",
            type: "chips",
            options: [
              { value: "yeshiva", label: "לומד בישיבה" },
              { value: "kolel", label: "אברך כולל" },
              { value: "chavruta", label: "לומד עם חברותא" },
              { value: "working", label: "עובד" },
              { value: "profession_student", label: "לומד מקצוע" },
              { value: "other", label: "לא משנה" },
            ],
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "female",
              },
            ],
          },
          {
            name: "partner.headCoverType",
            width: "full",
            label: "סוג כיסוי ראש רצוי",
            type: "radio",
            options: [
              { value: "kerchief", label: "מטפחת" },
              { value: "wig", label: "פאה" },
              {
                value: "kerchief_on_wig",
                label: "מטפחת על הפאה",
              },
              { value: "other", label: "לא משנה" },
            ],
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "male",
              },
            ],
          },
          {
            name: "partner.planForLife",
            width: "full",
            label: 'מתעתד בעז"ה',
            type: "radio",
            options: [
              { value: "koilel", label: "ללמוד בכולל" },
              {
                value: "torah_job",
                label: "לעבוד בעבודה תורנית",
              },
              {
                value: "mix_torah_work",
                label: "לשלב תורה ועבודה",
              },
              { value: "work", label: "לעבוד" },
            ],
            condition: [
              {
                parameter: "gender",
                operator: "===",
                value: "female",
              },
            ],
          },
          {
            name: "partner.cellphoneType",
            width: "full",
            label: "סוג טלפון מקובל",
            type: "radio",
            options: [
              { value: "kosher", label: "כשר" },
              { value: "sms", label: "SMS" },
              {
                value: "protected_smartphone",
                label: "סמארטפון מוגן",
              },
              { value: "other", label: "אחר" },
            ],
          },
          {
            name: "partner.aboutThePartner",
            width: "full",
            label: "כמה מילים על אופי וסגנון המיועד/ת",
            type: "textarea",
          },
          {
            name: "partner.additionalInformation",
            width: "full",
            label: "לעיני השדכן בלבד – מידע שחשוב שידע",
            type: "textarea",
            required: true,
          },
        ],
      },
      {
        name: "author",
        title: "ממלא הטופס",
        fields: [
          {
            name: "author.name",
            width: "sm",
            label: 'שם ממלא/ת הקו"ח',
            type: "text",
            description: "נא למלא את שם ממלא הקו״ח כדי שנדע לאן לפנות",
            required: true,
          },
          {
            name: "author.phone",
            width: "sm",
            label: 'טלפון ממלא/ת הקו"ח',
            type: "text",
            required: true,
          },
          {
            // הניסוח המגדרי נקבע ב-genderLabelOverrides (author.relation)
            name: "author.relation",
            width: "lg",
            label: "קשר למועמד/ת",
            type: "text",
            description: "לדוגמה: אב, אם, אח, קרוב משפחה, שדכן",
            required: true,
          },
        ],
      },
    ],
  },
];
