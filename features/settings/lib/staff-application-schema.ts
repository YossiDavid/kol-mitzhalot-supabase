import { z } from "zod";

import {
  INSTITUTION_GENDER_OPTIONS,
  INSTITUTION_TYPE_OPTIONS,
  type InstitutionGender,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";
import { optionalText, requiredChoice, requiredText } from "@/lib/forms/schema";

export const STAFF_PAGE_TITLE = "הצטרפות כאיש צוות";
export const STAFF_PAGE_DESCRIPTION =
  "ההצטרפות כאיש צוות נועדה לכתיבת משוב חיובי על כרטיסי המיועדים שמתחנכים אצלכם — מחמאות ותשבחות שיעזרו לשדכנים להכיר אותם טוב יותר. מלאו את המוסדות שבהם אתם מלמדים ואת התפקיד בכל אחד מהם.";

export const staffSchema = z.object({
  institutions: z.array(
    z.object({
      institutionId: requiredChoice("מוסד לימודים"),
      position: requiredText("תפקיד"),
    }),
  ),
});

export type StaffFormData = z.infer<typeof staffSchema>;

export interface ExistingStaffApplication {
  application_status: "pending" | "approved" | "rejected" | null;
}

export interface InstitutionOption {
  id: string;
  name: string;
  city: string | null;
  type: InstitutionType;
}

/**
 * סוגי מוסד שאיש צוות יכול ליצור. "תלמוד תורה" הוסר לבקשת המוצר.
 * הסינון מקומי בכוונה: INSTITUTION_TYPE_OPTIONS הוא מקור אמת משותף
 * שמסך ניהול המוסדות עדיין צריך במלואו, ויש מוסדות קיימים מהסוג הזה.
 */
export const STAFF_INSTITUTION_TYPE_OPTIONS = INSTITUTION_TYPE_OPTIONS.filter(
  (option) => option.value !== "talmud_torah",
);

const GENDER_VALUES = INSTITUTION_GENDER_OPTIONS.map((o) => o.value) as [
  InstitutionGender,
  ...InstitutionGender[],
];

const STAFF_TYPE_VALUES = STAFF_INSTITUTION_TYPE_OPTIONS.map(
  (o) => o.value,
) as [InstitutionType, ...InstitutionType[]];

/** טופס המוסד החדש נפרד מטופס הבקשה, כדי שהשגיאות לא יתערבבו */
export const newInstitutionSchema = z.object({
  name: requiredText("שם המוסד"),
  city: optionalText(),
  gender: z.enum(GENDER_VALUES),
  type: z.enum(STAFF_TYPE_VALUES),
});

export type NewInstitutionValues = z.infer<typeof newInstitutionSchema>;

export const EMPTY_NEW_INSTITUTION: NewInstitutionValues = {
  name: "",
  city: "",
  gender: "male",
  type: "yeshiva_gedola",
};
