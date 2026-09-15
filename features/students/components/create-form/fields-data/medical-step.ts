import type { FieldCondition } from "../field-visibility";
import { DOCUMENT_ACCEPT } from "./shared-options";
import type { FormSteps } from "./types";

/** שאר הפרטים הרפואיים מוצגים רק כשיש בעיה (קלה או משמעותית) */
function hasMedicalIssue(): FieldCondition[] {
  return [
    {
      parameter: "medical.status",
      operator: "in",
      value: ["littleProblem", "hugeProblem"],
    },
  ];
}

export const medicalStep: FormSteps = {
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
            { value: "no_exposure", label: "הסתרת עצם קיומה של הבעיה" },
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
          condition: hasMedicalIssue(),
        },
        {
          name: "medical.details",
          width: "full",
          label: "פירוט הבעיה הרפואית",
          type: "textarea",
          condition: hasMedicalIssue(),
        },
        {
          name: "medical.documents",
          width: "full",
          label: "העלאת מסמכים רפואיים",
          type: "upload",
          description: "גררו לכאן מסמכים רפואיים או בחרו מהמחשב (PDF / תמונה)",
          accept: DOCUMENT_ACCEPT,
          condition: hasMedicalIssue(),
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
          condition: hasMedicalIssue(),
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
          fields: [
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
            { value: "same_issue", label: "עם בעיה רפואית זהה" },
            {
              value: "similar_or_other",
              label: "בעיה רפואית דומה או אחרת באותה רמה",
            },
            { value: "no_issue", label: "ללא בעיה רפואית" },
          ],
          condition: hasMedicalIssue(),
        },
      ],
    },
  ],
};
