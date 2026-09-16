"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import {
  FormActions,
  FormFields,
  FormGrid,
  FormSubmitError,
} from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import {
  INSTITUTION_GENDER_OPTIONS,
  INSTITUTION_TYPE_LABELS,
  INSTITUTION_TYPE_OPTIONS,
  type InstitutionGender,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";
import {
  optionalText,
  requiredChoice,
  requiredText,
} from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/user-role";

/** כמה שורות שיוך מסומנות בשלד הטעינה. */
const SKELETON_AFFILIATION_COUNT = 2;

const staffSchema = z.object({
  institutions: z.array(
    z.object({
      institutionId: requiredChoice("מוסד לימודים"),
      position: requiredText("תפקיד"),
    }),
  ),
});

type StaffFormData = z.infer<typeof staffSchema>;

interface ExistingStaffApplication {
  application_status: "pending" | "approved" | "rejected" | null;
}

interface InstitutionOption {
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
const STAFF_INSTITUTION_TYPE_OPTIONS = INSTITUTION_TYPE_OPTIONS.filter(
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
const newInstitutionSchema = z.object({
  name: requiredText("שם המוסד"),
  city: optionalText(),
  gender: z.enum(GENDER_VALUES),
  type: z.enum(STAFF_TYPE_VALUES),
});

type NewInstitutionValues = z.infer<typeof newInstitutionSchema>;

const EMPTY_NEW_INSTITUTION: NewInstitutionValues = {
  name: "",
  city: "",
  gender: "male",
  type: "yeshiva_gedola",
};

/** שלד עמוד הבקשה, זהה במבנה לתוכן האמיתי כדי שלא תהיה קפיצה. */
function StaffPageSkeleton() {
  return (
    <Page width="form">
      <PageHeader
        title="הצטרפות כאיש צוות"
        description="ההצטרפות כאיש צוות נועדה לכתיבת משוב חיובי על כרטיסי המיועדים שמתחנכים אצלכם — מחמאות ותשבחות שיעזרו לשדכנים להכיר אותם טוב יותר. מלאו את המוסדות שבהם אתם מלמדים ואת התפקיד בכל אחד מהם."
      />
      <SkeletonRegion>
        <CardSkeleton footer>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-28 md:h-8" />
            </div>
            {Array.from({ length: SKELETON_AFFILIATION_COUNT }, (_, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start"
              >
                <Skeleton className="h-11 flex-1 md:h-10" />
                <Skeleton className="h-11 flex-1 md:h-10" />
                <Skeleton className="size-11 shrink-0 md:size-10" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      </SkeletonRegion>
    </Page>
  );
}

/**
 * useFieldArray מייצר מזהים עם crypto.randomUUID — ערך לא יציב שנדחה
 * ב-prerender, ולכן הטופס עצמו חייב לשבת מאחורי גבול Suspense.
 */
export default function StaffApplicationPage() {
  return (
    <Suspense fallback={<StaffPageSkeleton />}>
      <StaffApplicationForm />
    </Suspense>
  );
}

function StaffApplicationForm() {
  const router = useRouter();
  const [isFetching, setIsFetching] = useState(true);
  const [existingApplication, setExistingApplication] =
    useState<ExistingStaffApplication | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [isInstitutionsLoading, setIsInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState<string | null>(
    null,
  );
  const [isAddingInstitution, setIsAddingInstitution] = useState(false);

  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      institutions: [{ institutionId: "", position: "" }],
    },
  });

  const isLoading = form.formState.isSubmitting;

  const institutionFields = useFieldArray({
    control: form.control,
    name: "institutions",
  });

  // הוספת מוסד שלא קיים ברשימה. טופס נפרד, כדי ששגיאות ולידציה של המוסד
  // החדש לא ייחשבו כשגיאות של הבקשה עצמה.
  const newInstitutionForm = useForm<NewInstitutionValues>({
    resolver: zodResolver(newInstitutionSchema),
    defaultValues: EMPTY_NEW_INSTITUTION,
  });
  const isSavingInstitution = newInstitutionForm.formState.isSubmitting;

  const rows = useWatch({ control: form.control, name: "institutions" });

  const selectedInstitutionIds = (rows ?? [])
    .map((entry) => entry?.institutionId)
    .filter(Boolean);

  /** מוסד שכבר נבחר בשורה אחרת לא יוצע שוב, כדי למנוע כפילות. */
  const availableInstitutions = (index: number) => {
    const currentValue = rows?.[index]?.institutionId;
    const takenElsewhere = new Set(
      selectedInstitutionIds.filter((id) => id !== currentValue),
    );
    return institutions.filter((i) => !takenElsewhere.has(i.id));
  };

  const handleCreateInstitution = async (values: NewInstitutionValues) => {
    newInstitutionForm.clearErrors("root");
    try {
      const supabase = createClient();
      const { data: newId, error } = await supabase.rpc("request_institution", {
        p_name: values.name,
        p_gender: values.gender,
        p_type: values.type,
        p_city: values.city || null,
      });
      if (error) throw error;

      // ה-RPC מחזיר מוסד קיים אם השם והעיר זהים, ולכן ייתכן שהמזהה
      // כבר ברשימה המקומית.
      const alreadyListed = institutions.some((i) => i.id === newId);
      if (!alreadyListed) {
        setInstitutions((prev) =>
          [
            ...prev,
            {
              id: newId as string,
              name: values.name,
              city: values.city || null,
              type: values.type,
            },
          ].sort((a, b) => a.name.localeCompare(b.name, "he")),
        );
      }

      if (selectedInstitutionIds.includes(newId as string)) {
        toast.info("המוסד כבר נבחר באחת השורות");
      } else {
        // משבצים בשורה הריקה הראשונה, ואם אין — מוסיפים שורה
        const currentRows = form.getValues("institutions");
        const emptyIndex = currentRows.findIndex((r) => !r.institutionId);
        if (emptyIndex >= 0) {
          form.setValue(
            `institutions.${emptyIndex}.institutionId`,
            newId as string,
            { shouldValidate: true },
          );
        } else {
          institutionFields.append({
            institutionId: newId as string,
            position: "",
          });
        }
        toast.success(
          alreadyListed ? "המוסד כבר קיים במערכת ונבחר" : "המוסד נוסף ונבחר",
        );
      }

      newInstitutionForm.reset(EMPTY_NEW_INSTITUTION);
      setIsAddingInstitution(false);
    } catch (err) {
      console.error("Error creating institution:", err);
      newInstitutionForm.setError("root", { message: "שגיאה בהוספת המוסד" });
      toast.error("שגיאה בהוספת המוסד");
    }
  };

  useEffect(() => {
    async function fetchInstitutions() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, city, type")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        setInstitutionsError(`שגיאה בטעינת רשימת המוסדות: ${error.message}`);
        setIsInstitutionsLoading(false);
        return;
      }

      setInstitutions(data ?? []);
      setIsInstitutionsLoading(false);
    }

    fetchInstitutions();
  }, []);

  useEffect(() => {
    async function fetchExistingData() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      // בדיקה שהמשתמש לא איש צוות או אדמין
      if (hasRole(user, "staff") || hasRole(user, "admin")) {
        router.push("/app/settings");
        return;
      }

      // שליפת מידע קיים אם יש
      const { data, error } = await supabase
        .from("staff_info")
        .select("application_status")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching existing application:", error);
      }

      if (data) {
        setExistingApplication(data);

        const { data: affiliations } = await supabase
          .from("staff_institutions")
          .select("institution_id, position")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        form.reset({
          institutions: affiliations?.length
            ? affiliations.map((a) => ({
                institutionId: a.institution_id ?? "",
                position: a.position ?? "",
              }))
            : [{ institutionId: "", position: "" }],
        });
      }

      setIsFetching(false);
    }

    fetchExistingData();
  }, [router, form]);

  const onSubmit = async (data: StaffFormData) => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("יש להתחבר למערכת");
        return;
      }

      // כפילות: הבורר כבר מסנן מוסד שנבחר בשורה אחרת, אבל upsert עם
      // אותו מוסד פעמיים נכשל ב-"cannot affect row a second time".
      const seen = new Set<string>();
      const entries = data.institutions.filter((e) => {
        if (!e.institutionId || seen.has(e.institutionId)) return false;
        seen.add(e.institutionId);
        return true;
      });
      if (entries.length === 0) {
        toast.error("יש לבחור לפחות מוסד לימודים אחד");
        return;
      }

      // staff_info עדיין מחזיק את השיוך הראשון בעמודות הישנות, כדי
      // שממשקים שטרם הומרו ימשיכו להציג משהו.
      const insertData = {
        user_id: user.id,
        institution_id: entries[0].institutionId,
        position: entries[0].position || null,
        ...(existingApplication
          ? {}
          : {
              application_status: "pending" as const,
              submitted_at: new Date().toISOString(),
            }),
      };

      const { error } = await supabase.from("staff_info").upsert(insertData, {
        onConflict: "user_id",
      });

      if (error) throw error;

      // סנכרון רשימת המוסדות: מוחקים מה שהוסר, ואז upsert לשאר.
      const keptIds = entries.map((e) => e.institutionId);
      const { error: deleteError } = await supabase
        .from("staff_institutions")
        .delete()
        .eq("user_id", user.id)
        .not("institution_id", "in", `(${keptIds.join(",")})`);
      if (deleteError) throw deleteError;

      const { error: affiliationError } = await supabase
        .from("staff_institutions")
        .upsert(
          entries.map((e) => ({
            user_id: user.id,
            institution_id: e.institutionId,
            position: e.position || null,
          })),
          { onConflict: "user_id,institution_id" },
        );
      if (affiliationError) throw affiliationError;

      toast.success(
        existingApplication
          ? "הבקשה עודכנה בהצלחה"
          : "הבקשה נשלחה בהצלחה וממתינה לאישור",
      );
      router.push("/app/settings");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "אירעה שגיאה בשליחת הבקשה";
      toast.error(errorMessage);
      console.error("Error submitting staff application:", error);
    }
  };

  if (isFetching) {
    return <StaffPageSkeleton />;
  }

  return (
    <Page width="form">
      <PageHeader
        title="הצטרפות כאיש צוות"
        description="ההצטרפות כאיש צוות נועדה לכתיבת משוב חיובי על כרטיסי המיועדים שמתחנכים אצלכם — מחמאות ותשבחות שיעזרו לשדכנים להכיר אותם טוב יותר. מלאו את המוסדות שבהם אתם מלמדים ואת התפקיד בכל אחד מהם."
      />
      <Card>
        <CardHeader>
          <CardTitle>טופס הצטרפות</CardTitle>
          <CardDescription>
            אנא מלא את כל הפרטים הרלוונטיים. הבקשה תבדק על ידי מנהל המערכת.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FormFields>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>מוסדות לימוד ותפקיד</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoading || isInstitutionsLoading}
                      onClick={() =>
                        institutionFields.append({
                          institutionId: "",
                          position: "",
                        })
                      }
                    >
                      <Plus className="size-4" />
                      הוספת מוסד
                    </Button>
                  </div>

                  {institutionsError ? (
                    <p className="text-body-sm text-destructive">
                      {institutionsError}
                    </p>
                  ) : !isInstitutionsLoading && institutions.length === 0 ? (
                    <p className="text-body-sm text-muted-foreground">
                      לא הוגדרו עדיין מוסדות לימוד במערכת. נא לפנות למנהל המערכת
                      כדי להוסיף את המוסד שלכם לרשימה.
                    </p>
                  ) : (
                    institutionFields.fields.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-end"
                      >
                        <FormField
                          control={form.control}
                          name={`institutions.${index}.institutionId`}
                          render={({ field }) => (
                            <FormFieldShell
                              label="מוסד לימודים"
                              required
                              className="flex-1"
                            >
                              <NativeSelect
                                {...field}
                                disabled={isLoading || isInstitutionsLoading}
                              >
                                <NativeSelectOption value="" disabled>
                                  {isInstitutionsLoading
                                    ? "טוען מוסדות..."
                                    : "בחר/י מוסד לימודים"}
                                </NativeSelectOption>
                                {availableInstitutions(index).map(
                                  (institution) => (
                                    <NativeSelectOption
                                      key={institution.id}
                                      value={institution.id}
                                    >
                                      {`${institution.name}${institution.city ? ` · ${institution.city}` : ""} · ${INSTITUTION_TYPE_LABELS[institution.type]}`}
                                    </NativeSelectOption>
                                  ),
                                )}
                              </NativeSelect>
                            </FormFieldShell>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`institutions.${index}.position`}
                          render={({ field }) => (
                            <FormFieldShell
                              label="תפקיד"
                              required
                              className="flex-1"
                            >
                              <Input
                                {...field}
                                placeholder="לדוגמה: משגיח, מחנכת"
                                disabled={isLoading}
                              />
                            </FormFieldShell>
                          )}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 self-end text-muted-foreground"
                          aria-label="הסרת המוסד"
                          // המוסד האחרון לא נמחק: בלעדיו אין בקשה
                          disabled={
                            isLoading || institutionFields.fields.length === 1
                          }
                          onClick={() => institutionFields.remove(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))
                  )}

                  {isAddingInstitution ? (
                    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
                      <p className="text-body-sm font-medium">הוספת מוסד חדש</p>
                      <Form {...newInstitutionForm}>
                        <FormFields>
                          <FormGrid>
                            <FormField
                              control={newInstitutionForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormFieldShell label="שם המוסד" required>
                                  <Input
                                    {...field}
                                    disabled={isSavingInstitution}
                                  />
                                </FormFieldShell>
                              )}
                            />
                            <FormField
                              control={newInstitutionForm.control}
                              name="city"
                              render={({ field }) => (
                                <FormFieldShell label="עיר">
                                  <Input
                                    {...field}
                                    disabled={isSavingInstitution}
                                  />
                                </FormFieldShell>
                              )}
                            />
                            <FormField
                              control={newInstitutionForm.control}
                              name="gender"
                              render={({ field }) => (
                                <FormFieldShell label="מגדר" required>
                                  <NativeSelect
                                    {...field}
                                    disabled={isSavingInstitution}
                                  >
                                    {INSTITUTION_GENDER_OPTIONS.map((o) => (
                                      <NativeSelectOption
                                        key={o.value}
                                        value={o.value}
                                      >
                                        {o.label}
                                      </NativeSelectOption>
                                    ))}
                                  </NativeSelect>
                                </FormFieldShell>
                              )}
                            />
                            <FormField
                              control={newInstitutionForm.control}
                              name="type"
                              render={({ field }) => (
                                <FormFieldShell label="סוג מוסד" required>
                                  <NativeSelect
                                    {...field}
                                    disabled={isSavingInstitution}
                                  >
                                    {STAFF_INSTITUTION_TYPE_OPTIONS.map((o) => (
                                      <NativeSelectOption
                                        key={o.value}
                                        value={o.value}
                                      >
                                        {o.label}
                                      </NativeSelectOption>
                                    ))}
                                  </NativeSelect>
                                </FormFieldShell>
                              )}
                            />
                          </FormGrid>

                          <FormSubmitError>
                            {newInstitutionForm.formState.errors.root?.message}
                          </FormSubmitError>

                          <FormActions>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isSavingInstitution}
                              onClick={() => setIsAddingInstitution(false)}
                            >
                              ביטול
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSavingInstitution}
                              onClick={() =>
                                void newInstitutionForm.handleSubmit(
                                  handleCreateInstitution,
                                )()
                              }
                            >
                              {isSavingInstitution ? "שומר..." : "הוספה ובחירה"}
                            </Button>
                          </FormActions>
                        </FormFields>
                      </Form>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingInstitution(true)}
                      className="text-body-sm text-primary underline underline-offset-4"
                    >
                      המוסד לא ברשימה? הוספת מוסד חדש
                    </button>
                  )}
                </div>

                <FormActions>
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={isLoading}
                  >
                    <Link href="/app/settings">ביטול</Link>
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading
                      ? "שולח..."
                      : existingApplication
                        ? "עדכן בקשה"
                        : "שלח בקשה"}
                  </Button>
                </FormActions>
              </FormFields>
            </form>
          </Form>
        </CardContent>
      </Card>
    </Page>
  );
}
