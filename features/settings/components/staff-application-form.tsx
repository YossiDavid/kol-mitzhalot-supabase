"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormActions, FormFields } from "@/components/ui/form-layout";
import { Label } from "@/components/ui/label";
import { NewInstitutionSection } from "@/features/settings/components/new-institution-section";
import { StaffInstitutionRows } from "@/features/settings/components/staff-institution-rows";
import { StaffPageSkeleton } from "@/features/settings/components/staff-application-skeleton";
import {
  STAFF_PAGE_DESCRIPTION,
  STAFF_PAGE_TITLE,
  staffSchema,
  type ExistingStaffApplication,
  type InstitutionOption,
  type NewInstitutionValues,
  type StaffFormData,
} from "@/features/settings/lib/staff-application-schema";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/user-role";

export function StaffApplicationForm() {
  const router = useRouter();
  const [isFetching, setIsFetching] = useState(true);
  const [existingApplication, setExistingApplication] =
    useState<ExistingStaffApplication | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [isInstitutionsLoading, setIsInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState<string | null>(
    null,
  );

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

  const handleInstitutionCreated = (
    newId: string,
    values: NewInstitutionValues,
  ) => {
    // ה-RPC מחזיר מוסד קיים אם השם והעיר זהים, ולכן ייתכן שהמזהה
    // כבר ברשימה המקומית.
    const alreadyListed = institutions.some((i) => i.id === newId);
    if (!alreadyListed) {
      setInstitutions((prev) =>
        [
          ...prev,
          {
            id: newId,
            name: values.name,
            city: values.city || null,
            type: values.type,
          },
        ].sort((a, b) => a.name.localeCompare(b.name, "he")),
      );
    }

    if (selectedInstitutionIds.includes(newId)) {
      toast.info("המוסד כבר נבחר באחת השורות");
      return;
    }

    // משבצים בשורה הריקה הראשונה, ואם אין — מוסיפים שורה
    const currentRows = form.getValues("institutions");
    const emptyIndex = currentRows.findIndex((r) => !r.institutionId);
    if (emptyIndex >= 0) {
      form.setValue(`institutions.${emptyIndex}.institutionId`, newId, {
        shouldValidate: true,
      });
    } else {
      institutionFields.append({ institutionId: newId, position: "" });
    }
    toast.success(
      alreadyListed ? "המוסד כבר קיים במערכת ונבחר" : "המוסד נוסף ונבחר",
    );
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
        title={STAFF_PAGE_TITLE}
        description={STAFF_PAGE_DESCRIPTION}
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
                    <StaffInstitutionRows
                      form={form}
                      institutionFields={institutionFields}
                      availableInstitutions={availableInstitutions}
                      isLoading={isLoading}
                      isInstitutionsLoading={isInstitutionsLoading}
                    />
                  )}

                  <NewInstitutionSection onCreated={handleInstitutionCreated} />
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
