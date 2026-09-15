import type { FieldCondition } from "../field-visibility";
import { genderIs } from "./shared-options";
import type { FormSection } from "./types";

/** פרטי התעסוקה מוצגים רק לתגית שנבחרה ב"מה עושה כיום?" */
function tagSelected(tag: string): FieldCondition[] {
  return [{ parameter: "employment.tags", operator: "includes", value: tag }];
}

export const employmentSection: FormSection = {
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
      condition: genderIs("male"),
    },
    {
      name: "employment.tags",
      width: "full",
      label: "מה עושה כיום?",
      type: "chips",
      options: [
        { label: "תלמידת סמינר", value: "seminar" },
        { label: "עובדת", value: "working" },
        { label: "לומדת מקצוע", value: "profession" },
        { label: "בבית", value: "at_home" },
      ],
      condition: genderIs("female"),
    },
    {
      name: "employment.yeshiva",
      width: "lg",
      label: "איפה?",
      type: "text",
      beforeField: "לומד בישיבה",
      condition: tagSelected("yeshiva"),
    },
    {
      name: "employment.kolel",
      width: "lg",
      label: "איפה?",
      type: "text",
      beforeField: "אברך כולל",
      condition: tagSelected("kolel"),
    },
    {
      name: "employment.havruta.with",
      width: "lg",
      label: "עם מי?",
      type: "text",
      beforeField: "לומד עם חברותא",
      condition: tagSelected("havruta"),
    },
    {
      name: "employment.havruta.where",
      width: "lg",
      label: "איפה?",
      type: "text",
      condition: tagSelected("havruta"),
    },
    {
      name: "employment.seminar",
      width: "lg",
      label: "איפה?",
      type: "text",
      beforeField: "תלמידת סמינר",
      condition: tagSelected("seminar"),
    },
    {
      name: "employment.working.role",
      width: "lg",
      label: "תפקיד?",
      type: "text",
      beforeField: "עבודה",
      condition: tagSelected("working"),
    },
    {
      name: "employment.working.where",
      width: "lg",
      label: "איפה?",
      type: "text",
      condition: tagSelected("working"),
    },
    {
      name: "employment.profession.what",
      width: "lg",
      label: "מה?",
      type: "text",
      beforeField: "לומד/ת מקצוע",
      condition: tagSelected("profession"),
    },
    {
      name: "employment.profession.where",
      width: "lg",
      label: "איפה?",
      type: "text",
      condition: tagSelected("profession"),
    },
  ],
};
