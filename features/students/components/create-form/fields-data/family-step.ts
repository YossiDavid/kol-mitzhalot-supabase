import type { FieldCondition } from "../field-visibility";
import { FEMALE_NAME_TITLES, MALE_NAME_TITLES } from "./shared-options";
import type { FormSteps } from "./types";

/**
 * טלפון, עיסוק ואימייל לא נשאלים על הורה שנפטר. "מי נפטר" נאסף בשלב "מצב
 * ההורים", שמופיע לפני השלב הזה (fields-data/index.ts), והאשף מנקה אותו
 * כשהסטטוס חדל להיות אלמנ/ה (student-form-wizard.tsx)
 */
function parentIsAlive(parent: "father" | "mother"): FieldCondition[] {
  return [
    { parameter: "parents.deadParent", operator: "!==", value: parent },
    { parameter: "parents.deadParent", operator: "!==", value: "both" },
  ];
}

export const familyStep: FormSteps = {
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
          ...MALE_NAME_TITLES,
          required: true,
          width: "lg",
        },
        {
          name: "father.phone",
          label: "טלפון",
          type: "text",
          width: "sm",
          required: true,
          condition: parentIsAlive("father"),
        },
        {
          name: "father.job",
          label: "עיסוק",
          type: "text",
          width: "sm",
          required: true,
          condition: parentIsAlive("father"),
        },
        {
          name: "father.grandFather",
          label: "שם אביו",
          type: "textAndSelect",
          ...MALE_NAME_TITLES,
          required: true,
          width: "lg",
        },
        {
          name: "father.grandMother",
          label: "שם אמו",
          type: "textAndSelect",
          ...FEMALE_NAME_TITLES,
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
          condition: parentIsAlive("father"),
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
          ...FEMALE_NAME_TITLES,
          required: true,
          width: "lg",
        },
        {
          name: "mother.phone",
          label: "טלפון",
          type: "text",
          width: "sm",
          required: true,
          condition: parentIsAlive("mother"),
        },
        {
          name: "mother.job",
          label: "עיסוק",
          type: "text",
          width: "sm",
          required: true,
          condition: parentIsAlive("mother"),
        },
        {
          name: "mother.grandFather",
          label: "שם אביה",
          type: "textAndSelect",
          ...MALE_NAME_TITLES,
          required: true,
          width: "lg",
        },
        {
          name: "mother.grandMother",
          label: "שם אימה",
          type: "textAndSelect",
          ...FEMALE_NAME_TITLES,
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
          condition: parentIsAlive("mother"),
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
          fields: [
            {
              // מושבת בהחלטת הבעלים, ונשמר לשימוש עתידי: /users/mechutanim לא
              // קיים (404) וטרם הוחלט מאיפה החיפוש. בינתיים ממלאים את פרטי
              // המחותן ידנית. להפעלה: מוחקים את hidden ומממשים את החיפוש
              // (למשל table + fillOnSelect כמו במוסדות הלימוד)
              hidden: true,
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
};
