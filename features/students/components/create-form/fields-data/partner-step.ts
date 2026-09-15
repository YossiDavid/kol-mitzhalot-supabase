import {
  CELLPHONE_TYPE_OPTIONS,
  PLAN_FOR_LIFE_OPTIONS,
  genderIs,
} from "./shared-options";
import type { FormSteps } from "./types";

export const partnerStep: FormSteps = {
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
          fields: [
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
          condition: genderIs("male"),
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
          condition: genderIs("female"),
        },
        {
          name: "partner.headCoverType",
          width: "full",
          label: "סוג כיסוי ראש רצוי",
          type: "radio",
          options: [
            { value: "kerchief", label: "מטפחת" },
            { value: "wig", label: "פאה" },
            { value: "kerchief_on_wig", label: "מטפחת על הפאה" },
            { value: "other", label: "לא משנה" },
          ],
          condition: genderIs("male"),
        },
        {
          name: "partner.planForLife",
          width: "full",
          label: 'מתעתד בעז"ה',
          type: "radio",
          options: PLAN_FOR_LIFE_OPTIONS,
          condition: genderIs("female"),
        },
        {
          name: "partner.cellphoneType",
          width: "full",
          label: "סוג טלפון מקובל",
          type: "radio",
          options: CELLPHONE_TYPE_OPTIONS,
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
};
