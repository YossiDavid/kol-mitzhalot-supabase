"use client";

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

const REPEATER_FIELD_TYPES = ["repeater"] as const;

interface Condition {
  parameter: string;
  operator: "===" | "!==" | "includes";
  value: string;
}

// Types
interface BaseField {
  name: string;
  id?: string;
  label: string;
  placeholder?: string;
  description?: string;
  beforeField?: string;
  required?: boolean;
  value?: string;
  onChange?: (e?: any) => void;
  className?: string;
  columns?: number;
  condition?: Condition[];
}

export interface TextField extends BaseField {
  type: (typeof TEXT_FIELD_TYPES)[number];
}

export interface SelectField extends BaseField {
  type: (typeof SELECT_FIELD_TYPES)[number];
  options: {
    value: string;
    label: string;
  }[];
  empty?: string;
  vertical?: boolean;
  endpoint?: string;
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

export interface RepeaterField {
  type: (typeof REPEATER_FIELD_TYPES)[number];
  name: string;
  fileds: Field[];
  condition?: Condition[];
}

export type Field =
  | TextField
  | SelectField
  | TextAndSelectField
  | RangeField
  | UploadField
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
            label: "אני ממלא/ת את טופס הקו״ח עבור:",
            type: "radio",
            options: [
              { value: "male", label: "מיועד" },
              { value: "female", label: "מיועדת" },
            ],
            required: true,
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
            label: "שם פרטי",
            type: "text",
            required: true,
            columns: 3,
          },
          {
            name: "lastName",
            label: "שם משפחה",
            type: "text",
            required: true,
            columns: 3,
          },
          {
            name: "identityNumber",
            label: "תעודת זהות",
            type: "text",
            required: true,
            columns: 3,
          },
          {
            name: "birthDate",
            label: "תאריך לידה",
            type: "date",
            required: true,
            columns: 3,
          },
          {
            name: "image",
            label: "הוספת תמונה",
            type: "upload",
            multiple: false,
            maxFiles: 1,
            accept: { "image/*": [".png", ".jpg", ".jpeg"] },
            description: "התמונות תשלח לצד השני רק לאחר הסכמתכם",
            required: true,
            columns: -1,
          },
          {
            name: "country",
            label: "ארץ",
            type: "text",
            required: true,
            columns: 3,
          },
          {
            name: "city",
            label: "עיר",
            type: "text",
            required: true,
            columns: 3,
          },
          {
            name: "street",
            label: "רחוב",
            type: "text",
            required: true,
            columns: 3,
          },
          {
            name: "house",
            label: "מספר בית",
            type: "text",
            required: true,
            columns: 3,
          },
          {
            name: "community",
            label: "חסידות או קהילה",
            type: "text",
            columns: 3,
          },
          {
            name: "shtible",
            label: "שם השטיבל",
            type: "text",
            columns: 3,
          },
          {
            name: "personalStatus",
            label: "סטטוס אישי",
            type: "select",
            options: [
              {
                value: "single",
                label: "רווק.ה",
              },
              {
                value: "divorce",
                label: "גרוש.ה",
              },
              {
                value: "widower",
                label: "אלמנ.ה",
              },
            ],
            columns: 3,
            required: true,
          },
          {
            name: "height",
            label: "גובה",
            type: "text",
            columns: 3,
          },
          {
            name: "cellphoneType",
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
            columns: 4,
            required: true,
          },
          {
            name: "phone",
            label: "מספר טלפון של המיועד.ת",
            type: "text",
            columns: 4,
          },
          {
            name: "planForLife",
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
            columns: 4,
            required: true,
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
            columns: 4,
            required: true,
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
            label: "כמה מילים על אופי וסגנון המיועד.ת",
            type: "textarea",
            columns: -1,
          },
          {
            name: "cv",
            label: "הוספת קובץ קורות חיים",
            type: "upload",
            multiple: false,
            description: "המסמך יישלח לצד השני רק לאחר הסכמתכם",
            required: true,
            accept: {
              "application/pdf": [".pdf"],
              "image/*": [".png", ".jpg", ".jpeg"],
            },
            columns: -1,
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
            columns: 4,
          },
          {
            name: "father.phone",
            label: "טלפון",
            type: "text",
            columns: 3,
            required: true,
          },
          {
            name: "father.job",
            label: "עיסוק",
            type: "text",
            columns: 3,
            required: true,
          },
          {
            name: "father.email",
            label: "אימייל",
            type: "text",
            columns: 2,
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
            columns: 4,
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
            columns: 4,
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
            columns: 4,
          },
          {
            name: "mother.phone",
            label: "טלפון",
            type: "text",
            columns: 3,
            required: true,
          },
          {
            name: "mother.job",
            label: "עיסוק",
            type: "text",
            columns: 3,
            required: true,
          },
          {
            name: "mother.email",
            label: "אימייל",
            type: "text",
            columns: 2,
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
            columns: 4,
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
            columns: 4,
          },
          {
            name: "mother.maidenName",
            label: "שם נעורים",
            type: "text",
            columns: 2,
            required: true,
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
            columns: 3,
          },
          {
            name: "family.currentChildPlace",
            type: "number",
            label: "מיקום הילד בין האחים",
            required: true,
            columns: 3,
          },
          {
            name: "family.about",
            type: "textarea",
            label: "כמה מילים על סגנון המשפחה",
            required: true,
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
            fileds: [
              {
                name: "family.mechutanim.id",
                type: "select2",
                placeholder: "חיפוש במאגר",
                label: "לבחירה מתוך המאגר",
                options: [],
                endpoint: "/users/mechutanim",
                columns: 3,
              },
              {
                name: "family.mechutanim.firstName",
                type: "text",
                label: "שם פרטי",
                columns: 3,
              },
              {
                name: "family.mechutanim.lastName",
                type: "text",
                label: "שם משפחה",
                columns: 3,
              },
              {
                name: "family.mechutanim.city",
                type: "text",
                label: "עיר",
                columns: 3,
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
            fileds: [
              {
                name: "education.yeshivaKtana.id",
                label: "לבחירה מתוך המאגר",
                type: "select2",
                options: [{ value: "", label: "" }],
                endpoint: "/educational-institutions/yeshiva-ktana",
                columns: 3,
              },
              {
                name: "education.yeshivaKtana.name",
                label: "שם הישיבה",
                type: "text",
                required: true,
                columns: 3,
              },
              {
                name: "education.yeshivaKtana.community",
                label: "קהילה / חסידות",
                type: "text",
                required: true,
                columns: 3,
              },
              {
                name: "education.yeshivaKtana.city",
                label: "עיר",
                type: "text",
                required: true,
                columns: 3,
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
            fileds: [
              {
                name: "education.yeshivaGdola.id",
                label: "לבחירה מתוך המאגר",
                type: "select2",
                options: [{ value: "", label: "" }],
                endpoint: "/educational-institutions/yeshiva-gdola",
                columns: 3,
              },
              {
                name: "education.yeshivaGdola.name",
                label: "שם הישיבה",
                type: "text",
                required: true,
                columns: 3,
              },
              {
                name: "education.yeshivaGdola.community",
                label: "קהילה / חסידות",
                type: "text",
                required: true,
                columns: 3,
              },
              {
                name: "education.yeshivaGdola.city",
                label: "עיר",
                type: "text",
                required: true,
                columns: 3,
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
            fileds: [
              {
                name: "education.kolel.id",
                label: "לבחירה מתוך המאגר",
                type: "select2",
                options: [{ value: "", label: "" }],
                endpoint: "/educational-institutions/kolel",
                columns: 3,
              },
              {
                name: "education.kolel.name",
                label: "שם הישיבה",
                type: "text",
                required: true,
                columns: 3,
              },
              {
                name: "education.kolel.community",
                label: "קהילה / חסידות",
                type: "text",
                required: true,
                columns: 3,
              },
              {
                name: "education.kolel.city",
                label: "עיר",
                type: "text",
                required: true,
                columns: 3,
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
            fileds: [
              {
                name: "education.seminar.id",
                label: "לבחירה מתוך המאגר",
                type: "select2",
                options: [{ value: "", label: "" }],
                endpoint: "/educational-institutions/seminar",
                columns: 3,
              },
              {
                name: "education.seminar.name",
                label: "שם הישיבה",
                type: "text",
                required: true,
                columns: 3,
              },
              {
                name: "education.seminar.community",
                label: "קהילה / חסידות",
                type: "text",
                required: true,
                columns: 3,
              },
              {
                name: "education.seminar.city",
                label: "עיר",
                type: "text",
                required: true,
                columns: 3,
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
            required: true,
          },

          {
            name: "employment.tags",
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
            required: true,
          },
          {
            name: "employment.yeshiva",
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
            fileds: [
              {
                name: "previousPartners.separationType",
                label: "אופן הפרידה",
                type: "radio",
                options: [
                  {
                    label: "גירושין",
                    value: "divorce",
                  },
                  { label: "פטירה", value: "death" },
                ],
                columns: -1,
                required: true,
              },
              {
                name: "previousPartners.fullName",
                label: "שם מלא של בן/בת הזוג הקודם/ה",
                type: "text",
                columns: 3,
                required: true,
              },
              {
                name: "previousPartners.parents.fathersName",
                label: "שם האב",
                type: "text",
                columns: 3,
                required: true,
              },
              {
                name: "previousPartners.parents.mothersName",
                label: "שם האם",
                type: "text",
                columns: 3,
                required: true,
              },
              {
                name: "previousPartners.parents.address",
                label: "כתובת ההורים",
                type: "text",
                columns: 3,
                required: true,
              },
              {
                name: "previousPartners.marriageDate",
                label: "תאריך נישואין",
                type: "date",
                columns: 3,
                required: true,
              },
              {
                name: "previousPartners.divorce.date",
                label: "תאריך גירושין",
                type: "date",
                columns: 3,
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "divorce",
                  },
                ],
                required: true,
              },
              {
                name: "previousPartners.deathDate",
                label: "תאריך פטירה",
                type: "date",
                columns: 3,
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "death",
                  },
                ],
                required: true,
              },
              {
                name: "previousPartners.childrenNumber",
                label: "מספר ילדים מנישואין אלו",
                type: "number",
                columns: 3,
                required: true,
              },
              {
                name: "previousPartners.marriedChildrenNumber",
                label: "מתוכם נשואים",
                type: "number",
                columns: 3,
                required: true,
              },
              {
                name: "previousPartners.divorce.reason",
                label: "סיבת הגירושין",
                type: "textarea",
                columns: -1,
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "divorce",
                  },
                ],
                required: true,
              },
              {
                name: "previousPartners.divorce.rabbiName",
                label: "שם הרב המלווה בגירושין",
                type: "text",
                columns: 3,
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "divorce",
                  },
                ],
                required: true,
              },
              {
                name: "previousPartners.divorce.rabbiPhone",
                label: "טלפון של הרב",
                type: "text",
                columns: 3,
                condition: [
                  {
                    parameter: "previousPartners.separationType",
                    operator: "===",
                    value: "divorce",
                  },
                ],
                required: true,
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
            fileds: [
              {
                name: "knownRabbanim.id",
                type: "select2",
                label: "לבחירה מתוך המאגר",
                options: [{ value: "", label: "" }],
                endpoint: "/users/rabanim-option",
                columns: 3,
              },
              {
                name: "knownRabbanim.name",
                type: "text",
                label: "שם מלא",
                required: true,
                columns: 3,
              },
              {
                name: "knownRabbanim.role",
                type: "text",
                label: "תפקיד",
                columns: 3,
              },
              {
                name: "knownRabbanim.phone",
                type: "text",
                label: "טלפון",
                required: true,
                columns: 3,
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
            fileds: [
              {
                name: "knownFriends.name",
                type: "text",
                label: "שם מלא",
                required: true,
                columns: 4,
              },
              {
                name: "knownFriends.phone",
                type: "text",
                label: "טלפון",
                required: true,
                columns: 4,
              },
              {
                name: "knownFriends.email",
                type: "text",
                label: "אימייל",
                columns: 4,
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
            fileds: [
              {
                name: "knownFamilyFriends.name",
                type: "text",
                label: "שם מלא",
                required: true,
                columns: 4,
              },
              {
                name: "knownFamilyFriends.phone",
                type: "text",
                label: "טלפון",
                required: true,
                columns: 4,
              },
              {
                name: "knownFamilyFriends.email",
                type: "text",
                label: "אימייל",
                columns: 4,
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
            label: "סטטוס ההורים",
            type: "radio",
            options: [
              { value: "married", label: "נשואים" },
              { value: "divorced", label: "גרושים" },
              { value: "widowed", label: "אלמנ/ה" },
            ],
            required: true,
          },
          {
            name: "parents.holding",
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
            required: true,
          },
          {
            name: "parents.deadParent",
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
            required: true,
          },
          {
            name: "parents.fatherDeathDate",
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
            required: true,
          },
          {
            name: "parents.newHusbandName",
            label: "שם הבעל החדש",
            type: "text",
            condition: [
              {
                parameter: "parents.isMotherRemarried",
                operator: "===",
                value: "true",
              },
            ],
            required: true,
          },
          {
            name: "parents.isFatherRemarried",
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
            required: true,
          },
          {
            name: "parents.newWifeName",
            label: "שם האשה החדשה",
            type: "text",
            condition: [
              {
                parameter: "parents.isFatherRemarried",
                operator: "===",
                value: "true",
              },
            ],
            required: true,
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
            label: "מצב בריאותי כללי",
            type: "radio",
            options: [
              { value: "good", label: "תקין" },
              { value: "littleProblem", label: "בעיה קלה" },
              { value: "hugeProblem", label: "בעיה משמעותית" },
            ],
            required: true,
          },
          {
            name: "medical.exposureLevel",
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
                operator: "!==",
                value: "good",
              },
            ],
          },
          {
            name: "medical.details",
            label: "פירוט הבעיה הרפואית",
            type: "textarea",
            condition: [
              {
                parameter: "medical.status",
                operator: "!==",
                value: "good",
              },
            ],
          },
          {
            name: "medical.documents",
            label: "העלאת מסמכים רפואיים",
            type: "upload",
            description:
              "גררו לכאן מסמכים רפואיים או בחרו מהמחשב (PDF / תמונה)",
            accept: {
              "application/pdf": [".pdf"],
              "image/*": [".png", ".jpg", ".jpeg"],
            },
            columns: -1,
            condition: [
              {
                parameter: "medical.status",
                operator: "!==",
                value: "good",
              },
            ],
          },
          {
            name: "medical.contactForMoreInfo",
            label: "עם מי לדבר על פרטים נוספים",
            type: "radio",
            options: [
              { value: "parents", label: "ההורים" },
              { value: "other_contact", label: "מישהו אחר" },
            ],
            condition: [
              {
                parameter: "medical.status",
                operator: "!==",
                value: "good",
              },
            ],
          },
          {
            type: "repeater",
            name: "medical.otherContact",
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
                label: "שם איש קשר",
                type: "text",
                required: true,
              },
              {
                name: "medical.otherContact.phone",
                label: "טלפון",
                type: "text",
                required: true,
              },
              {
                name: "medical.otherContact.email",
                label: "אימייל",
                type: "text",
              },
            ],
          },
          {
            name: "medical.relatedIssuePreference",
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
                operator: "!==",
                value: "good",
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
            label: "טווח גילאים",
            type: "rangeDouble",
            required: true,
          },
          {
            name: "partner.preferredCountry",
            label: "ארץ מועדפת",
            type: "radio",
            options: [
              { value: "all", label: "אין העדפה" },
              { value: "specific", label: "מדינות מסוימות" },
            ],
            required: true,
          },
          {
            type: "repeater",
            name: "partner.specificCountries",
            condition: [
              {
                parameter: "partner.preferredCountry",
                operator: "===",
                value: "specific",
              },
            ],
            fileds: [
              {
                name: "partner.specificCountries.locale",
                label: "קוד מדינה (אופציונלי)",
                type: "text",
              },
              {
                name: "partner.specificCountries.name",
                label: "שם המדינה",
                type: "text",
                required: true,
              },
            ],
          },
          {
            name: "partner.workStatus",
            label: "סטטוס תעסוקתי מבוקש",
            type: "radio",
            options: [
              { value: "student", label: "תלמידה" },
              { value: "working", label: "עובד/ת" },
              { value: "yeshiva", label: "תלמיד ישיבה" },
              { value: "chavruta", label: "לומד עם חברותא" },
              {
                value: "profession_student",
                label: "לומד/ת מקצוע",
              },
              { value: "other", label: "לא משנה" },
            ],
          },
          {
            name: "partner.headCoverType",
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
            label: "כמה מילים על אופי וסגנון המיועד/ת",
            type: "textarea",
            columns: -1,
          },
          {
            name: "partner.additionalInformation",
            label: "לעיני השדכן בלבד – מידע שחשוב שידע",
            type: "textarea",
            columns: -1,
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
            label: 'שם ממלא/ת הקו"ח',
            type: "text",
            columns: 3,
            description: "נא למלא את שם ממלא הקו״ח כדי שנדע לאן לפנות",
            required: true,
          },
          {
            name: "author.phone",
            label: 'טלפון ממלא/ת הקו"ח',
            type: "text",
            columns: 3,
            required: true,
          },
        ],
      },
    ],
  },
];
