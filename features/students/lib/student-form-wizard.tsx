"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Form } from "@/components/ui/form";
import { Box, PageTitle } from "@/components/layout";
import { studentFields } from "@/features/students/components/create-form/fields-data";
import { DynamicField } from "@/features/students/components/create-form/fields/dynamic-field";
import { FIELD_GRID_CLASS } from "@/features/students/components/create-form/field-layout";
import { useConditionsMet } from "@/features/students/components/create-form/use-form-conditions";
import {
  studentFormSchema,
  type StudentFormValues,
} from "@/features/students/components/create-form/schema";
import {
  DevSkipStepValidationToggle,
  useDevSkipStepValidation,
} from "@/features/students/lib/dev-skip-step-validation";
import { focusFirstInvalidField } from "@/features/students/lib/focus-first-invalid-field";
import { StudentFormActionsBar } from "@/features/students/lib/student-form-actions-bar";
import { StudentFormStepsNav } from "@/features/students/lib/student-form-steps-nav";
import { useUnsavedChangesWarning } from "@/features/students/lib/use-unsaved-changes-warning";

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
  nickname: "",
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

const INVALID_SAVE_MESSAGE =
  "השינויים לא נשמרו: יש שדות שצריך להשלים או לתקן. עברנו לשדה הראשון.";

export type StudentFormWizardProps = {
  heading: string;
  submitLabel: string;
  submittingLabel: string;
  /** ערכי התחלה לעריכה. ביצירה נשאר undefined ומתקבל טופס ריק. */
  initialValues?: StudentFormValues;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  /**
   * עריכה בלבד: "שמירת שינויים" מכל שלב, בלי לעזוב אותו. מחזיר האם נשמר.
   * אחרי שמירה מוצלחת ההורה טוען מחדש מהשרת, וה-initialValues החדשים
   * הופכים לנקודת הייחוס (ראה isAwaitingSavedValuesRef).
   */
  onSaveProgress?: (values: StudentFormValues) => Promise<boolean>;
  /** עריכה: הנתונים השמורים נטענים מחדש מהשרת אחרי שמירה */
  isRefreshingSavedValues?: boolean;
};

export function StudentFormWizard({
  heading,
  submitLabel,
  submittingLabel,
  initialValues,
  onSubmit,
  onSaveProgress,
  isRefreshingSavedValues = false,
}: StudentFormWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  // נעילה סינכרונית: הוולידציה אסינכרונית, ולחיצה כפולה הייתה עוברת לפני
  // שה-state התעדכן
  const isSaveLockedRef = useRef(false);
  // שמירה הצליחה וממתינים ל-initialValues המעודכנים מהשרת
  const isAwaitingSavedValuesRef = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const afterStepChangeRef = useRef<AfterStepChange>(null);
  const [shouldSkipStepValidation, setShouldSkipStepValidation] =
    useDevSkipStepValidation();

  const form = useForm<FormValues>({
    mode: "onTouched",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(studentFormSchema) as any,
    defaultValues: initialValues ?? emptyStudentFormValues,
    // הפוקוס לשגיאה מנוהל כאן, לפי סדר התצוגה ועם גלילה מתחת לכותרת הדביקה
    shouldFocusError: false,
  });

  // האשף צופה רק במגדר (תוויות ושמות שלבים). תנאי תצוגה נצפים בכל שדה ומקטע
  // לחוד (use-form-conditions.ts), כדי שהקלדה לא תרנדר את כל הטופס
  const gender = (useWatch({ control: form.control, name: "gender" }) ?? "") as
    | "male"
    | "female"
    | "";

  const steps = studentFields;
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const isEditMode = Boolean(onSaveProgress);
  const { isDirty } = form.formState;
  const isSavingOrRefreshing = isSavingProgress || isRefreshingSavedValues;
  const isBusy = isSubmitting || isSavingOrRefreshing;

  useUnsavedChangesWarning(isEditMode && isDirty && !isBusy);

  // הנתונים השמורים הגיעו מהשרת: הם נקודת הייחוס החדשה. השדות נעולים מאז
  // הלחיצה על שמירה, ולכן האיפוס לא דורס עריכה. השלב הנוכחי נשמר - הוא
  // state של האשף ולא ערך בטופס. קובץ שהועלה חוזר כ-existingUrl / תמונה
  // שמורה, ולכן לא יועלה שוב בשמירה הבאה.
  useEffect(() => {
    if (!isAwaitingSavedValuesRef.current || !initialValues) return;
    isAwaitingSavedValuesRef.current = false;
    form.reset(initialValues);
  }, [form, initialValues]);

  // הטעינה מחדש הסתיימה בלי נתונים חדשים (למשל נכשלה): לא לאפס בהמשך
  useEffect(() => {
    if (!isRefreshingSavedValues) isAwaitingSavedValuesRef.current = false;
  }, [isRefreshingSavedValues]);

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
    // development בלבד: מעבר חופשי בין שלבים. השליחה עדיין מאמתת את כל הטופס
    if (shouldSkipStepValidation) return true;
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
      getStepFieldNames(step).some(
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
    if (isBusy) return;
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ה-RPC מחליף את כל הכרטיס, ולכן שמירה מאמצע האשף מאמתת את כל הטופס -
  // גם כשבורר הפיתוח מדלג על ולידציית השלבים
  const saveProgress = async (values: FormValues) => {
    if (!onSaveProgress) return;
    setIsSavingProgress(true);
    isAwaitingSavedValuesRef.current = true;
    try {
      const isSaved = await onSaveProgress(values);
      if (!isSaved) isAwaitingSavedValuesRef.current = false;
    } catch (error) {
      isAwaitingSavedValuesRef.current = false;
      console.error("Saving student form progress failed:", error);
      toast.error("אירעה שגיאה לא צפויה בשמירה");
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleInvalidSaveProgress = () => {
    toast.error(INVALID_SAVE_MESSAGE);
    handleInvalidSubmit();
  };

  const handleSaveProgressClick = async (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSaveLockedRef.current || isBusy || !isDirty) return;
    isSaveLockedRef.current = true;
    try {
      await form.handleSubmit(saveProgress, handleInvalidSaveProgress)();
    } finally {
      isSaveLockedRef.current = false;
    }
  };

  if (!currentStep) {
    return null;
  }

  return (
    <div className="my-2 space-y-4 md:my-6 md:space-y-6">
      <PageTitle>{heading}</PageTitle>
      <DevSkipStepValidationToggle
        isEnabled={shouldSkipStepValidation}
        onChange={setShouldSkipStepValidation}
      />
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
            isForwardDisabled={
              !shouldSkipStepValidation &&
              currentStep.name === "intro" &&
              !gender
            }
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

              {/* בזמן שמירה השדות נעולים (inert, בלי לשנות את מראם), כדי
                  שעריכה באמצע לא תידרס באיפוס לנתונים השמורים */}
              <div
                className="mt-6 divide-y divide-border"
                inert={isSavingOrRefreshing}
                aria-busy={isSavingOrRefreshing}
              >
                {currentStep.sections.map((section) => (
                  <SectionRenderer
                    key={section.name}
                    section={section}
                    form={form}
                    gender={gender}
                  />
                ))}
              </div>

              <StudentFormActionsBar
                isFirstStep={currentStepIndex === 0}
                isLastStep={isLastStep}
                isSubmitting={isSubmitting}
                submitLabel={submitLabel}
                submittingLabel={submittingLabel}
                onPrevious={handlePreviousStep}
                onNext={handleNextStep}
                saveProgress={
                  isEditMode
                    ? {
                        isDirty,
                        isSaving: isSavingOrRefreshing,
                        savingLabel: submittingLabel,
                        onSave: (e) => void handleSaveProgressClick(e),
                      }
                    : undefined
                }
              />
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
  gender: "male" | "female" | "";
};

// מרווח בין מקטעים (קו מפריד + 32px מכל צד) גדול בבירור מהמרווח בין שדות (24px)
function SectionRenderer({ section, form, gender }: SectionRendererProps) {
  const { control } = form;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isVisible = useConditionsMet(control as any, section.condition);

  if (!section.fields.length || !isVisible) {
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
            gender={gender}
            getLabel={getFieldLabel}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * כל השדות של השלב, כולל רשומות חוזרות: שגיאה בשדה בתוך שורה נמצאת מתחת
 * לשם הרשומה, ולכן trigger על השם הזה בודק את כל השורות. שדות מוסתרים לא
 * מחזירים שגיאה (required-fields.ts), כך שאין צורך לסנן אותם כאן.
 */
function getStepFieldNames(step: Step): string[] {
  return step.sections.flatMap((section) =>
    section.fields.map((field) => field.name),
  );
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
