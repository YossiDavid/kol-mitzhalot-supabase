import {
  MAX_STUDENT_PHOTOS,
  MAX_STUDENT_PHOTO_MB,
} from "@/features/students/lib/student-photo-rules";
import {
  CELLPHONE_TYPE_OPTIONS,
  COMMUNITY_SEARCH,
  DOCUMENT_ACCEPT,
  PLAN_FOR_LIFE_OPTIONS,
  genderIs,
} from "./shared-options";
import type { FormSteps, SelectField } from "./types";

/** מוסד הלימודים הנוכחי, מתוך מאגר המוסדות לפי מגדר המיועד/ת */
function currentInstitutionField(gender: "male" | "female"): SelectField {
  return {
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
    filters: { gender, is_active: true },
    condition: genderIs(gender),
  };
}

export const basicInformationStep: FormSteps = {
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
          // בורר מתוך מאגר הקהילות; ערך שאינו במאגר מוצע להוספה. הערך שנשמר
          // בכרטיס הוא השם עצמו (טקסט), ולכן כרטיסים ישנים נשארים תקפים
          type: "select2",
          options: [],
          ...COMMUNITY_SEARCH,
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
          options: CELLPHONE_TYPE_OPTIONS,
          required: true,
        },
        {
          name: "phone",
          width: "sm",
          label: "מספר טלפון של המיועד.ת",
          type: "text",
        },
        currentInstitutionField("male"),
        currentInstitutionField("female"),
        {
          name: "planForLife",
          width: "sm",
          label: "מתעתד בעז״ה:",
          type: "select",
          vertical: true,
          options: PLAN_FOR_LIFE_OPTIONS,
          condition: genderIs("male"),
        },
        {
          name: "headCoverType",
          width: "sm",
          label: "סוג כיסוי ראש נהוג",
          type: "select",
          vertical: true,
          options: [
            { value: "kerchief", label: "מטפחת" },
            { value: "wig", label: "פאה" },
            { value: "kerchief_on_wig", label: "מטפחת על פאה" },
            { value: "other", label: "לא משנה" },
          ],
          condition: genderIs("female"),
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
          storedFileLabel: "קובץ קו״ח קיים",
          description: "המסמך יישלח לצד השני רק לאחר הסכמתכם",
          accept: DOCUMENT_ACCEPT,
        },
      ],
    },
  ],
};
