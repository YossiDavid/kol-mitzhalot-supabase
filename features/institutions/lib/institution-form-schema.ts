import { z } from "zod";

import {
  INSTITUTION_GENDER_OPTIONS,
  INSTITUTION_TYPE_OPTIONS,
  type InstitutionGender,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";
import { optionalText, requiredText } from "@/lib/forms/schema";

export type Institution = {
  id: string;
  name: string;
  city: string | null;
  gender: InstitutionGender;
  type: InstitutionType;
  is_active: boolean;
  created_at: string;
};

const GENDER_VALUES = INSTITUTION_GENDER_OPTIONS.map((o) => o.value) as [
  InstitutionGender,
  ...InstitutionGender[],
];

const TYPE_VALUES = INSTITUTION_TYPE_OPTIONS.map((o) => o.value) as [
  InstitutionType,
  ...InstitutionType[],
];

export const institutionSchema = z.object({
  name: requiredText("שם המוסד"),
  city: optionalText(),
  gender: z.enum(GENDER_VALUES),
  type: z.enum(TYPE_VALUES),
  is_active: z.boolean(),
});

export type InstitutionFormState = z.infer<typeof institutionSchema>;

export const EMPTY_INSTITUTION_FORM: InstitutionFormState = {
  name: "",
  city: "",
  gender: "male",
  type: "yeshiva_gedola",
  is_active: true,
};
