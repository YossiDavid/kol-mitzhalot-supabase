"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/layout";
import { studentFields } from "@/features/students/components/create-form/fileds-data";
import { DynamicField } from "@/features/students/components/create-form/fields/dynamic-field";
import { FIELD_GRID_CLASS } from "@/features/students/components/create-form/field-layout";
import {
  studentFormSchema,
  type StudentFormValues,
} from "@/features/students/components/create-form/schema";
import { focusFirstInvalidField } from "@/features/students/lib/focus-first-invalid-field";
import { StudentFormStepsNav } from "@/features/students/lib/student-form-steps-nav";

// אשף הקו״ח משרת גם יצירה וגם עריכה: אותם שלבים, אותה ולידציה, אותה תצוגה.
// ההבדל היחיד בין המצבים הוא ערכי ההתחלה ומה שקורה בשליחה, ולכן שניהם
// מוזרקים כ-props ולא מסועפים כאן.

type Step = (typeof studentFields)[number];

type FormValues = StudentFormValues;

/** מה קורה אחרי שהשלב הבא רונדר */
type AfterStepChange = "scrollToTop" | "focusFirstError" | null;

export const emptyStudentFormValues: StudentFormValues = {
  isOnShiduchim: true,
  gender: "",
  firstName: "",
  lastName: "",
  identityNumber: "",
  birthDate: "",
  photos: [],
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

// מתחת ל-md הניווט התחתון של האפליקציה קבוע בתחתית המסך
// (components/layout/bottom-nav.tsx, h-16 + safe area), ולכן הפס יושב מעליו.
// הפס דביק ולא fixed: בסוף השלב הוא חוזר למקומו ולא מסתיר את השדה האחרון.
const STICKY_ACTIONS_CLASS =
  "sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-2 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 md:bottom-0 md:mx-0 md:px-0 md:py-4";

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
  const [completedSteps, setCompletedSteps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const afterStepChangeRef = useRef<AfterStepChange>(null);

  const form = useForm<FormValues>({
    mode: "onTouched",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(studentFormSchema) as any,
    defaultValues: initialValues ?? emptyStudentFormValues,
    // הפוקוס לשגיאה מנוהל כאן, לפי סדר התצוגה ועם גלילה מתחת לכותרת הדביקה
    shouldFocusError: false,
  });

  const formValues = form.watch();

  const steps = studentFields;
  const currentStep = steps[currentStepIndex];
  const gender = formValues.gender as "male" | "female" | "";
  const isLastStep = currentStepIndex === steps.length - 1;

  const focusFirstError = useCallback(() => {
    void focusFirstInvalidField(
      formRef.current,
      (name) => form.getFieldState(name as FieldPath<FormValues>).invalid,
    );
  }, [form]);

  useEffect(() => {
    const action = afterStepChangeRef.current;
    afterStepChangeRef.current = null;
    if (action === "focusFirstError") {
      focusFirstError();
      return;
    }
    // שלב חדש נפתח מלמעלה, גם כשלחצו "הבא" מתחתית שלב ארוך
    if (action === "scrollToTop" && shellRef.current) {
      if (shellRef.current.getBoundingClientRect().top < 0) {
        shellRef.current.scrollIntoView({ block: "start" });
      }
    }
  }, [currentStepIndex, focusFirstError]);

  const goToStep = (index: number, after: AfterStepChange) => {
    afterStepChangeRef.current = after;
    setCurrentStepIndex(index);
  };

  const markStepCompleted = (index: number) => {
    setCompletedSteps((previous) =>
      previous.has(index) ? previous : new Set([...previous, index]),
    );
  };

  const validateCurrentStep = async () => {
    const fieldNames = getStepFieldNames(currentStep);
    const isValid = await form.trigger(
      fieldNames as Array<FieldPath<FormValues>>,
    );
    if (isValid) {
      markStepCompleted(currentStepIndex);
    } else {
      focusFirstError();
    }
    return isValid;
  };

  const handleNextStep = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    const isValid = await validateCurrentStep();
    if (!isValid || isLastStep) return;
    goToStep(currentStepIndex + 1, "scrollToTop");
  };

  const handlePreviousStep = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (currentStepIndex === 0) return;
    goToStep(currentStepIndex - 1, "scrollToTop");
  };

  const handleStepClick = async (targetIndex: number) => {
    if (targetIndex === currentStepIndex) return;
    const isMovingForward = targetIndex > currentStepIndex;
    if (isMovingForward && !(await validateCurrentStep())) return;
    goToStep(targetIndex, "scrollToTop");
  };

  // השליחה מאמתת את כל הטופס. שגיאה בשלב אחר (למשל בעריכה) פותחת את השלב
  // הזה ומעבירה פוקוס לשדה, במקום שהכפתור ייראה כאילו לא עשה כלום.
  const handleInvalidSubmit = () => {
    const errorStepIndex = steps.findIndex((step) =>
      getStepFieldNames(step, { includeRepeaters: true }).some(
        (name) => form.getFieldState(name as FieldPath<FormValues>).invalid,
      ),
    );
    if (errorStepIndex === -1 || errorStepIndex === currentStepIndex) {
      focusFirstError();
      return;
    }
    goToStep(errorStepIndex, "focusFirstError");
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
    <div className="my-2 space-y-4 md:my-6 md:space-y-6">
      <h1 className="text-title font-bold md:text-heading">{heading}</h1>
      {/* במובייל הכרטיס נפרש עד קצוות המסך, כדי שהשדות יקבלו את כל הרוחב */}
      <Box
        ref={shellRef}
        className="scroll-mt-20 px-4 pt-5 pb-0 max-md:-mx-3 max-md:rounded-none md:px-6 md:pt-6"
      >
        <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-6">
          <StudentFormStepsNav
            titles={steps.map((step) => getStepTitle(step, gender))}
            currentStepIndex={currentStepIndex}
            completedSteps={completedSteps}
            isForwardDisabled={currentStep.name === "intro" && !gender}
            onStepClick={handleStepClick}
          />
          <Form {...form}>
            <form
              ref={formRef}
              onSubmit={form.handleSubmit(handleSubmit, handleInvalidSubmit)}
              className="min-w-0"
            >
              <div className="space-y-1">
                <p className="text-caption text-muted-foreground lg:hidden">
                  שלב {currentStepIndex + 1} מתוך {steps.length}
                </p>
                <h2 className="text-subtitle font-bold md:text-title">
                  {getStepTitle(currentStep, gender)}
                </h2>
              </div>

              <div className="mt-6 divide-y divide-border">
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

              <div className={STICKY_ACTIONS_CLASS}>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handlePreviousStep}
                  disabled={currentStepIndex === 0}
                >
                  <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
                  <span>חזרה</span>
                </Button>

                {isLastStep ? (
                  <Button type="submit" disabled={isSubmitting}>
                    <span>{isSubmitting ? submittingLabel : submitLabel}</span>
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
                  >
                    <span>המשך לשלב הבא</span>
                    <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </Box>
    </div>
  );
}

type SectionRendererProps = {
  section: Step["sections"][number];
  form: ReturnType<typeof useForm<FormValues>>;
  values: FormValues;
  gender: "male" | "female" | "";
};

// מרווח בין מקטעים (קו מפריד + 32px מכל צד) גדול בבירור מהמרווח בין שדות (24px)
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
    <section className="space-y-5 py-8 first:pt-0">
      {section.title && (
        <h3 className="text-body font-bold text-foreground md:text-subtitle">
          {section.title}
        </h3>
      )}
      <div className={FIELD_GRID_CLASS}>
        {section.fields.map((field, index) => (
          <DynamicField
            key={`${field.name}-${index}`}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            field={field as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            control={control as any}
            values={values}
            gender={gender}
            getLabel={getFieldLabel}
          />
        ))}
      </div>
    </section>
  );
}

function getStepFieldNames(
  step: Step,
  { includeRepeaters = false }: { includeRepeaters?: boolean } = {},
): string[] {
  return step.sections.flatMap((section) =>
    section.fields
      .filter((field) => includeRepeaters || field.type !== "repeater")
      .map((field) => field.name),
  );
}

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

function getFieldLabel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getValueByPath(source: Record<string, any>, path: unknown) {
  if (typeof path !== "string") return undefined;
  if (!path) return undefined;
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return segments.reduce<any>((acc, segment) => {
    if (acc == null) return undefined;
    return acc[segment];
  }, source);
}
