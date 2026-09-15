import type { FieldCondition } from "../field-visibility";
import type { FormSteps } from "./types";

function is(parameter: string, value: string): FieldCondition {
  return { parameter, operator: "===", value };
}

function isNot(parameter: string, value: string): FieldCondition {
  return { parameter, operator: "!==", value };
}

const PARENT_OPTIONS = [
  { value: "mother", label: "האם" },
  { value: "father", label: "האב" },
  { value: "both", label: "שניהם" },
];

const YES_NO_OPTIONS = [
  { value: "true", label: "כן" },
  { value: "false", label: "לא" },
];

export const parentsStatusStep: FormSteps = {
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
          options: PARENT_OPTIONS,
          condition: [is("parents.status", "divorced")],
        },
        {
          name: "parents.deadParent",
          width: "lg",
          label: "מי נפטר?",
          type: "radio",
          options: PARENT_OPTIONS,
          condition: [is("parents.status", "widowed")],
        },
        {
          name: "parents.fatherDeathDate",
          width: "lg",
          label: "תאריך פטירת האב",
          type: "date",
          condition: [
            is("parents.status", "widowed"),
            isNot("parents.deadParent", "mother"),
            isNot("parents.deadParent", "mother"),
          ],
        },
        {
          name: "parents.motherDeathDate",
          width: "lg",
          label: "תאריך פטירת האם",
          type: "date",
          condition: [
            is("parents.status", "widowed"),
            isNot("parents.deadParent", "father"),
            isNot("parents.deadParent", "father"),
          ],
        },
        {
          name: "parents.isMotherRemarried",
          width: "lg",
          label: "האם האם נישאה מחדש?",
          type: "radio",
          options: YES_NO_OPTIONS,
          condition: [
            isNot("parents.status", "married"),
            isNot("parents.status", ""),
            isNot("parents.deadParent", "mother"),
            isNot("parents.deadParent", "both"),
          ],
        },
        {
          name: "parents.newHusbandName",
          width: "lg",
          label: "שם הבעל החדש",
          type: "text",
          condition: [
            is("parents.isMotherRemarried", "true"),
            // ההורים נשואים — אין בן/בת זוג חדש, גם אם נבחר קודם סטטוס אחר
            // והערך של הרדיו נשאר.
            isNot("parents.status", "married"),
            isNot("parents.status", ""),
            // הרדיו למעלה מוסתר כששני ההורים נפטרו, אך ערכו נשאר. בלי
            // השערים האלה השדה ממשיך להופיע אחרי שינוי deadParent.
            isNot("parents.deadParent", "both"),
            isNot("parents.deadParent", "mother"),
          ],
        },
        {
          name: "parents.isFatherRemarried",
          width: "lg",
          label: "האם האב נישא מחדש?",
          type: "radio",
          options: YES_NO_OPTIONS,
          condition: [
            isNot("parents.status", "married"),
            isNot("parents.status", ""),
            isNot("parents.deadParent", "father"),
            isNot("parents.deadParent", "both"),
          ],
        },
        {
          name: "parents.newWifeName",
          width: "lg",
          label: "שם האשה החדשה",
          type: "text",
          condition: [
            is("parents.isFatherRemarried", "true"),
            // ההורים נשואים — אין בן/בת זוג חדש, גם אם נבחר קודם סטטוס אחר
            // והערך של הרדיו נשאר.
            isNot("parents.status", "married"),
            isNot("parents.status", ""),
            isNot("parents.deadParent", "both"),
            isNot("parents.deadParent", "father"),
          ],
        },
      ],
    },
  ],
};
