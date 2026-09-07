"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Box, Section } from "@/components/layout";
import { cn } from "@/lib/utils";
import { studentFields } from "@/features/students/components/create-form/fileds-data";
import { DynamicField } from "@/features/students/components/create-form/fields/dynamic-field";
import {
  studentFormSchema,
  type StudentFormValues,
} from "@/features/students/components/create-form/schema";

// אשף הקו״ח משרת גם יצירה וגם עריכה: אותם שלבים, אותה ולידציה, אותה תצוגה.
// ההבדל היחיד בין המצבים הוא ערכי ההתחלה ומה שקורה בשליחה, ולכן שניהם
// מוזרקים כ-props ולא מסועפים כאן.

type Step = (typeof studentFields)[number];

type FormValues = StudentFormValues;

export const emptyStudentFormValues: StudentFormValues = {
  isOnShiduchim: true,
  gender: "",
  firstName: "",
  lastName: "",
  identityNumber: "",
  birthDate: "",
  image: {
    file: null as File | null,
  },
  country: "",
  city: "",
  street: "",
  house: "",
  community: "",
  shtible: "",
  institutionId: "",
  personalStatus: "",
  height: "",
  cellphoneType: "",
  phone: "",
  planForLife: "",
  headCoverType: "",
  about: "",
  cv: {
    file: null as File | null,
  },
  father: {
    self: { prefix: "", name: "", suffix: "" },
    phone: "",
    job: "",
    email: "",
    grandFather: { prefix: "", name: "", suffix: "" },
    grandMother: { prefix: "", name: "", suffix: "" },
  },
  mother: {
    self: { prefix: "", name: "", suffix: "" },
    maidenName: "",
    phone: "",
    job: "",
    email: "",
    grandFather: { prefix: "", name: "", suffix: "" },
    grandMother: { prefix: "", name: "", suffix: "" },
  },
  family: {
    numberOfChildren: "",
    currentChildPlace: "",
    about: "",
    mechutanim: [] as Array<{
      id?: string;
      firstName?: string;
      lastName?: string;
      city?: string;
    }>,
  },
  education: {
    yeshivaKtana: [] as Array<{
      id?: string;
      name?: string;
      community?: string;
      city?: string;
    }>,
    yeshivaGdola: [] as Array<{
      id?: string;
      name?: string;
      community?: string;
      city?: string;
    }>,
    kolel: [] as Array<{
      id?: string;
      name?: string;
      community?: string;
      city?: string;
    }>,
    seminar: [] as Array<{
      id?: string;
      name?: string;
      community?: string;
      city?: string;
    }>,
  },
  employment: {
    tags: [] as string[],
    yeshiva: "",
    kolel: "",
    seminar: "",
    havruta: {
      with: "",
      where: "",
    },
    working: {
      role: "",
      where: "",
    },
    profession: {
      what: "",
      where: "",
    },
  },
  previousPartners: [] as Array<Record<string, unknown>>,
  knownRabbanim: [] as Array<Record<string, unknown>>,
  knownFriends: [] as Array<Record<string, unknown>>,
  knownFamilyFriends: [] as Array<Record<string, unknown>>,
  parents: {
    status: "",
    holding: "",
    deadParent: "",
    fatherDeathDate: "",
    motherDeathDate: "",
    isMotherRemarried: "",
    newHusbandName: "",
    isFatherRemarried: "",
    newWifeName: "",
  },
  medical: {
    status: "",
    exposureLevel: "",
    details: "",
    documents: [] as File[],
    contactForMoreInfo: "",
    otherContact: [] as Array<Record<string, unknown>>,
    relatedIssuePreference: "",
  },
  partner: {
    ageRange: { min: 18, max: 40 },
    preferredCountry: "",
    specificCountries: [] as Array<Record<string, unknown>>,
    workStatus: [] as string[],
    headCoverType: "",
    planForLife: "",
    cellphoneType: "",
    aboutThePartner: "",
    additionalInformation: "",
  },
  author: {
    name: "",
    phone: "",
    relation: "",
  },
};

const genderLabelOverrides: Record<string, { male: string; female: string }> = {
  // Previous partner fields
  "previousPartners.fullName": {
    male: "שם מלא של האשה הקודמת",
    female: "שם מלא של הבעל הקודם",
  },
  "previousPartners.parents.fathersName": {
    male: "שם האב של האשה",
    female: "שם האב של הבעל",
  },
  "previousPartners.parents.mothersName": {
    male: "שם האם של האשה",
    female: "שם האם של הבעל",
  },
  "previousPartners.childrenNumber": {
    male: "מספר ילדים מנישואין אלו",
    female: "מספר ילדים מנישואין אלו",
  },
  "previousPartners.marriedChildrenNumber": {
    male: "מתוכם נשואים",
    female: "מתוכם נשואות",
  },
  // Father section — labels differ for male vs female student
  "father.self": {
    male: "שם אביו",
    female: "שם אביה",
  },
  "father.grandFather": {
    male: "שם אבי אביו",
    female: "שם אבי אביה",
  },
  "father.grandMother": {
    male: "שם אם אביו",
    female: "שם אם אביה",
  },
  // Mother section
  "mother.self": {
    male: "שם אמו",
    female: "שם אמה",
  },
  "mother.maidenName": {
    male: "שם נעורים של האם",
    female: "שם נעורים של האם",
  },
  "mother.grandFather": {
    male: "שם אבי אמו",
    female: "שם אבי אמה",
  },
  "mother.grandMother": {
    male: "שם אם אמו",
    female: "שם אם אמה",
  },
  // המיועד/ת עצמו/ה
  phone: {
    male: "מספר טלפון של המיועד",
    female: "מספר טלפון של המיועדת",
  },
  about: {
    male: "כמה מילים על אופי וסגנון המיועד",
    female: "כמה מילים על אופי וסגנון המיועדת",
  },
  // סעיף "מי שמחפשים" — המגדר הפוך: מיועד מחפש מיועדת ולהפך.
  "partner.aboutThePartner": {
    male: "כמה מילים על אופי וסגנון המיועדת",
    female: "כמה מילים על אופי וסגנון המיועד",
  },
  "author.relation": {
    male: "קשר למועמד",
    female: "קשר למועמדת",
  },
  // Family
  "family.currentChildPlace": {
    male: "מיקום הבן בין האחים",
    female: "מיקום הבת בין האחים",
  },
};

const genderedStepTitles: Record<string, { male: string; female: string }> = {
  previousPartners: {
    male: "פרטי אשה קודמת",
    female: "פרטי בעל קודם",
  },
  partner: {
    male: "קצת על המיועדת שאתם מחפשים",
    female: "קצת על המיועד שאתם מחפשים",
  },
};

export type StudentFormWizardProps = {
  heading: string;
  submitLabel: string;
  submittingLabel: string;
  /** ערכי התחלה לעריכה. ביצירה נשאר undefined ומתקבל טופס ריק. */
  initialValues?: StudentFormValues;
  onSubmit: (values: StudentFormValues) => Promise<void>;
};

export function StudentFormWizard({
  heading,
  submitLabel,
  submittingLabel,
  initialValues,
  onSubmit,
}: StudentFormWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    mode: "onTouched",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(studentFormSchema) as any,
    defaultValues: initialValues ?? emptyStudentFormValues,
  });

  const formValues = form.watch();

  const steps = studentFields;
  const currentStep = steps[currentStepIndex];
  const gender = formValues.gender as "male" | "female" | "";
  const isLastStep = currentStepIndex === steps.length - 1;

  const getStepFieldNames = (step: Step) => {
    const names: string[] = [];
    for (const section of step.sections) {
      for (const field of section.fields) {
        if (field.type === "repeater") continue;
        names.push(field.name as string);
      }
    }
    return names;
  };

  const canProceedFromCurrentStep = async () => {
    const fieldNames = getStepFieldNames(currentStep);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return form.trigger(fieldNames as any);
  };

  const handleNextStep = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    const valid = await canProceedFromCurrentStep();
    if (!valid) return;
    if (currentStepIndex === steps.length - 1) return;
    setCurrentStepIndex((prev) => prev + 1);
  };

  const handlePreviousStep = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (currentStepIndex === 0) return;
    setCurrentStepIndex((prev) => prev - 1);
  };

  const handleStepClick = async (targetIndex: number) => {
    if (targetIndex === currentStepIndex) return;
    const movingForward = targetIndex > currentStepIndex;
    if (movingForward) {
      const valid = await canProceedFromCurrentStep();
      if (!valid) return;
    }
    setCurrentStepIndex(targetIndex);
  };

  const handleSubmit = async (values: FormValues) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentStep) {
    return null;
  }

  return (
    <Section asChild className="my-4 space-y-4 md:my-10">
      <div>
        <h1 className="mb-4 text-heading font-bold md:text-heading">
          {heading}
        </h1>
        <Box className="p-4 md:p-8">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
            <StepSidebar
              steps={steps}
              currentStepIndex={currentStepIndex}
              onStepClick={handleStepClick}
              gender={gender}
            />
            <div>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-8"
                >
                  <div className="space-y-6">
                    <h2 className="text-title font-semibold md:text-heading">
                      {getStepTitle(currentStep, gender)}
                    </h2>
                    {currentStep.sections.map((section) => (
                      <SectionRenderer
                        key={section.name}
                        section={section}
                        form={form}
                        values={formValues}
                        gender={gender}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t pt-6">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handlePreviousStep}
                      disabled={currentStepIndex === 0}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="size-4 rtl:rotate-180" />
                      <span>חזרה</span>
                    </Button>

                    {isLastStep ? (
                      <Button
                        type="submit"
                        className="flex items-center gap-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <span>{submittingLabel}</span>
                        ) : (
                          <span>{submitLabel}</span>
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleNextStep}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <span>המשך לשלב הבא</span>
                        <ArrowRight className="size-4 rtl:rotate-180" />
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </Box>
      </div>
    </Section>
  );
}

type SectionRendererProps = {
  section: Step["sections"][number];
  form: ReturnType<typeof useForm<FormValues>>;
  values: FormValues;
  gender: "male" | "female" | "";
};

function SectionRenderer({
  section,
  form,
  values,
  gender,
}: SectionRendererProps) {
  const { control } = form;

  if (!section.fields.length || !shouldDisplaySection(section, values)) {
    return null;
  }

  return (
    <div className="space-y-4">
      {section.title && (
        <h3 className="text-subtitle font-semibold">{section.title}</h3>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {section.fields.map((field, index) => (
          <DynamicField
            key={`${field.name}-${index}`}
            field={field as any}
            control={control as any}
            values={values}
            gender={gender}
            getLabel={getFieldLabel}
          />
        ))}
      </div>
    </div>
  );
}

type StepSidebarProps = {
  steps: typeof studentFields;
  currentStepIndex: number;
  onStepClick: (index: number) => void;
  gender: "male" | "female" | "";
};

function shouldDisplaySection(
  section: Step["sections"][number],
  values: FormValues,
) {
  if (!section.condition || section.condition.length === 0) {
    return true;
  }

  return section.condition.every((condition) => {
    const compareValue = getValueByPath(values, condition.parameter);
    switch (condition.operator) {
      case "===":
        return compareValue === condition.value;
      case "!==":
        return compareValue !== condition.value;
      case "includes":
        return Array.isArray(compareValue)
          ? compareValue.includes(condition.value as never)
          : typeof compareValue === "string" &&
              compareValue.includes(String(condition.value));
      case "in":
        return (
          Array.isArray(condition.value) &&
          condition.value.includes(String(compareValue ?? ""))
        );
      default:
        return true;
    }
  });
}

function StepSidebar({
  steps,
  currentStepIndex,
  onStepClick,
  gender,
}: StepSidebarProps) {
  const disableForwardNavigation =
    steps[currentStepIndex]?.name === "intro" && !gender;

  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 md:block md:space-y-2 md:overflow-x-visible md:pb-0">
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isDisabled = disableForwardNavigation && index > currentStepIndex;
        return (
          <button
            key={step.name}
            type="button"
            onClick={() => onStepClick(index)}
            className={cn(
              "relative shrink-0 rounded-lg px-3 py-2 text-right transition md:w-full",
              isActive
                ? "bg-primary/10 text-primary md:before:absolute md:before:top-1/2 md:before:right-0 md:before:h-1/2 md:before:w-1 md:before:-translate-y-1/2 md:before:rounded-l-2xl md:before:bg-primary"
                : "bg-transparent hover:bg-muted/70",
              isDisabled && "cursor-not-allowed opacity-60",
            )}
            disabled={isDisabled}
          >
            {getStepTitle(step, gender)}
          </button>
        );
      })}
    </nav>
  );
}

function getFieldLabel(
  field: Record<string, any>,
  gender: "male" | "female" | "",
) {
  const baseName = normalizePath((field.originalName ?? field.name) as string);
  if (gender !== "male" && gender !== "female") {
    return field.label;
  }
  const override = genderLabelOverrides[baseName];
  if (!override) {
    return field.label;
  }
  return override[gender] ?? field.label;
}

function getStepTitle(step: Step, gender: "male" | "female" | "") {
  if (gender && genderedStepTitles[step.name]) {
    return genderedStepTitles[step.name][gender];
  }
  return step.title;
}

function normalizePath(path: string) {
  return path.replace(/\[\d+\]/g, "");
}

function getValueByPath(source: Record<string, any>, path: unknown) {
  if (typeof path !== "string") return undefined;
  if (!path) return undefined;
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  return segments.reduce<any>((acc, segment) => {
    if (acc == null) return undefined;
    return acc[segment];
  }, source);
}
