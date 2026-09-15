"use client";

import { basicInformationStep } from "./basic-information-step";
import { educationStep } from "./education-step";
import { familyStep } from "./family-step";
import { introStep } from "./intro-step";
import { medicalStep } from "./medical-step";
import { parentsStatusStep } from "./parents-status-step";
import { partnerStep } from "./partner-step";
import type { FormSteps } from "./types";

export * from "./types";

/** שלבי טופס המיועדים, לפי סדר התצוגה. קובץ לכל שלב בתיקייה הזו */
export const studentFields: FormSteps[] = [
  introStep,
  basicInformationStep,
  familyStep,
  educationStep,
  parentsStatusStep,
  medicalStep,
  partnerStep,
];
