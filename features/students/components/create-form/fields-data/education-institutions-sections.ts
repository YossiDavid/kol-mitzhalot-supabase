import type { FieldCondition } from "../field-visibility";
import { genderIs } from "./shared-options";
import type { FormSection, SelectField } from "./types";

/** סוגי המוסדות בטבלת institutions (supabase/migrations/20260830140000_institutions.sql) */
type InstitutionType =
  | "yeshiva_gedola"
  | "yeshiva_ketana"
  | "seminary"
  | "kollel";

/**
 * "לבחירה מתוך המאגר" ברשומות ההשכלה: חיפוש במאגר המוסדות לפי סוג ומגדר.
 * education_history שומרת שם ועיר ולא מזהה, ולכן הבחירה ממלאת אותם בשורה.
 */
function institutionSearch(
  type: InstitutionType,
  gender: "male" | "female",
): Pick<
  SelectField,
  | "placeholder"
  | "empty"
  | "options"
  | "table"
  | "valueColumn"
  | "labelColumn"
  | "searchColumn"
  | "filters"
  | "fillOnSelect"
> {
  return {
    placeholder: "חיפוש במאגר המוסדות...",
    empty: "לא נמצאו מוסדות",
    options: [],
    table: "institutions",
    valueColumn: "id",
    labelColumn: "name",
    searchColumn: "name",
    filters: { type, gender, is_active: true },
    fillOnSelect: { name: "name", city: "city" },
  };
}

type InstitutionSectionConfig = {
  sectionName: string;
  title: string;
  /** שם הרשומה בערכי הטופס, למשל "education.kolel" */
  repeaterName: string;
  addLabel: string;
  itemLabel: string;
  emptyText: string;
  nameLabel: string;
  institutionType: InstitutionType;
  gender: "male" | "female";
  condition: FieldCondition[];
};

/** מקטע של רשומת השכלה: בחירה מהמאגר, שם, קהילה ועיר */
function institutionSection({
  sectionName,
  title,
  repeaterName,
  addLabel,
  itemLabel,
  emptyText,
  nameLabel,
  institutionType,
  gender,
  condition,
}: InstitutionSectionConfig): FormSection {
  return {
    name: sectionName,
    title,
    fields: [
      {
        type: "repeater",
        name: repeaterName,
        addLabel,
        itemLabel,
        emptyText,
        fields: [
          {
            name: `${repeaterName}.id`,
            width: "sm",
            label: "לבחירה מתוך המאגר",
            type: "select2",
            ...institutionSearch(institutionType, gender),
          },
          {
            name: `${repeaterName}.name`,
            width: "sm",
            label: nameLabel,
            type: "text",
          },
          {
            name: `${repeaterName}.community`,
            width: "sm",
            label: "קהילה / חסידות",
            type: "text",
          },
          {
            name: `${repeaterName}.city`,
            width: "sm",
            label: "עיר",
            type: "text",
          },
        ],
      },
    ],
    condition,
  };
}

export const educationInstitutionSections: FormSection[] = [
  institutionSection({
    sectionName: "educationYeshivaKtana",
    title: "ישיבה קטנה",
    repeaterName: "education.yeshivaKtana",
    addLabel: "הוספת ישיבה קטנה",
    itemLabel: "ישיבה קטנה",
    emptyText: "עדיין לא נוספו ישיבות קטנות.",
    nameLabel: "שם הישיבה",
    institutionType: "yeshiva_ketana",
    gender: "male",
    condition: genderIs("male"),
  }),
  institutionSection({
    sectionName: "educationYeshivaGdola",
    title: "ישיבה גדולה",
    repeaterName: "education.yeshivaGdola",
    addLabel: "הוספת ישיבה גדולה",
    itemLabel: "ישיבה גדולה",
    emptyText: "עדיין לא נוספו ישיבות גדולות.",
    nameLabel: "שם הישיבה",
    institutionType: "yeshiva_gedola",
    gender: "male",
    condition: genderIs("male"),
  }),
  institutionSection({
    sectionName: "educationKolel",
    title: "כולל",
    repeaterName: "education.kolel",
    addLabel: "הוספת כולל",
    itemLabel: "כולל",
    emptyText: "עדיין לא נוספו כוללים.",
    nameLabel: "שם הכולל",
    institutionType: "kollel",
    gender: "male",
    condition: [
      { parameter: "personalStatus", operator: "!==", value: "single" },
      ...genderIs("male"),
    ],
  }),
  institutionSection({
    sectionName: "educationSeminar",
    title: "סמינר",
    repeaterName: "education.seminar",
    addLabel: "הוספת סמינר",
    itemLabel: "סמינר",
    emptyText: "עדיין לא נוספו סמינרים.",
    nameLabel: "שם הסמינר",
    institutionType: "seminary",
    gender: "female",
    condition: genderIs("female"),
  }),
];
