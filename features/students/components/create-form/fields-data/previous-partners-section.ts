import type { FieldCondition } from "../field-visibility";
import type { FormSection } from "./types";

function separationIs(type: "divorce" | "death"): FieldCondition[] {
  return [
    {
      parameter: "previousPartners.separationType",
      operator: "===",
      value: type,
    },
  ];
}

export const previousPartnersSection: FormSection = {
  name: "previousPartners",
  title: "פרטי בן/בת זוג קודם/ת",
  condition: [
    { parameter: "personalStatus", operator: "!==", value: "single" },
  ],
  fields: [
    {
      type: "repeater",
      name: "previousPartners",
      addLabel: "הוספת נישואים קודמים",
      itemLabel: "נישואים קודמים",
      emptyText: "עדיין לא נוספו פרטי נישואים קודמים.",
      fields: [
        {
          name: "previousPartners.separationType",
          width: "full",
          label: "אופן הפרידה",
          type: "radio",
          options: [
            { label: "גירושין", value: "divorce" },
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
          condition: separationIs("divorce"),
        },
        {
          name: "previousPartners.deathDate",
          width: "sm",
          label: "תאריך פטירה",
          type: "date",
          condition: separationIs("death"),
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
          condition: separationIs("divorce"),
        },
        {
          name: "previousPartners.divorce.rabbiPhone",
          width: "sm",
          label: "טלפון של הרב",
          type: "text",
          condition: separationIs("divorce"),
        },
        {
          name: "previousPartners.divorce.reason",
          width: "full",
          label: "סיבת הגירושין",
          type: "textarea",
          condition: separationIs("divorce"),
        },
      ],
    },
  ],
};
