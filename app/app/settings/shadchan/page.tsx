"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
} from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { SkeletonRegion } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredText,
  requiredWholeNumber,
} from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/user-role";

/** מספר שדות הטופס, לשלד הטעינה. */
const FORM_FIELD_COUNT = 6;

const shadchanSchema = z.object({
  bio: requiredText("ביוגרפיה"),
  experience_years: requiredWholeNumber("שנות ניסיון"),
  closed_matches: requiredWholeNumber("מספר השידוכים שנסגרו"),
  specializations: optionalText(),
  contact_phone: optionalPhone(),
  contact_email: optionalEmail(),
  languages: optionalText(),
});

type ShadchanFormData = z.infer<typeof shadchanSchema>;

const EMPTY_FORM: ShadchanFormData = {
  bio: "",
  experience_years: "",
  closed_matches: "",
  specializations: "",
  contact_phone: "",
  contact_email: "",
  languages: "",
};

/** רק מה שהטופס באמת צריך לדעת על בקשה שכבר הוגשה */
interface ExistingShadchanApplication {
  application_status: string | null;
}

/** שלד עמוד הבקשה, זהה במבנה לתוכן האמיתי כדי שלא תהיה קפיצה. */
function ShadchanPageSkeleton() {
  return (
    <Page width="form">
      <PageHeader
        title="הצטרפות כשדכן"
        description="מלא את הפרטים הבאים כדי להגיש בקשה להצטרפות כשדכן במערכת"
      />
      <SkeletonRegion>
        <CardSkeleton fields={FORM_FIELD_COUNT} footer />
      </SkeletonRegion>
    </Page>
  );
}

/** הטופס נשען על react-hook-form, ולכן יושב מאחורי גבול Suspense. */
export default function ShadchanApplicationPage() {
  return (
    <Suspense fallback={<ShadchanPageSkeleton />}>
      <ShadchanApplicationForm />
    </Suspense>
  );
}

function ShadchanApplicationForm() {
  const router = useRouter();
  const [isFetching, setIsFetching] = useState(true);
  const [existingApplication, setExistingApplication] =
    useState<ExistingShadchanApplication | null>(null);

  const form = useForm<ShadchanFormData>({
    resolver: zodResolver(shadchanSchema),
    defaultValues: EMPTY_FORM,
  });

  const { isSubmitting } = form.formState;

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

      // בדיקה שהמשתמש לא שדכן או אדמין
      if (hasRole(user, "shadchan") || hasRole(user, "admin")) {
        router.push("/app/settings");
        return;
      }

      // שליפת מידע קיים אם יש
      const { data, error } = await supabase
        .from("shadchanim_info")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching existing application:", error);
      }

      if (data) {
        setExistingApplication(data);
        // מילוי הטופס עם הנתונים הקיימים
        form.reset({
          bio: data.bio || "",
          experience_years: data.experience_years?.toString() || "",
          specializations: Array.isArray(data.specializations)
            ? data.specializations.join(", ")
            : data.specializations || "",
          contact_phone: data.contact_phone || "",
          contact_email: data.contact_email || "",
          languages: Array.isArray(data.languages)
            ? data.languages.join(", ")
            : data.languages || "",
          closed_matches: data.closed_matches?.toString() || "",
        });
      }

      setIsFetching(false);
    }

    fetchExistingData();
  }, [router, form]);

  /** "עברית, אנגלית" → ["עברית", "אנגלית"]; ריק → null */
  const toList = (value: string) => {
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length ? items : null;
  };

  const onSubmit = async (data: ShadchanFormData) => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("יש להתחבר למערכת");
        return;
      }

      // הערכים כבר חתוכי רווחים ותקינים - הסכמה בדקה אותם
      const insertData: Record<string, unknown> = {
        user_id: user.id,
        bio: data.bio || null,
        experience_years: data.experience_years
          ? parseInt(data.experience_years)
          : null,
        specializations: toList(data.specializations),
        contact_phone: data.contact_phone || null,
        contact_email: data.contact_email || null,
        languages: toList(data.languages),
        closed_matches: data.closed_matches
          ? parseInt(data.closed_matches)
          : null,
      };

      // אם זו בקשה חדשה, הוסף application_status = 'pending'
      if (!existingApplication) {
        insertData.application_status = "pending";
        insertData.submitted_at = new Date().toISOString();
      }

      // upsert לפי user_id
      const { error } = await supabase
        .from("shadchanim_info")
        .upsert(insertData, {
          onConflict: "user_id",
        });

      if (error) throw error;

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
      console.error("Error submitting shadchan application:", error);
    }
  };

  if (isFetching) {
    return <ShadchanPageSkeleton />;
  }

  return (
    <Page width="form">
      <PageHeader
        title="הצטרפות כשדכן"
        description="מלא את הפרטים הבאים כדי להגיש בקשה להצטרפות כשדכן במערכת"
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
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormFieldShell label="ביוגרפיה" required>
                      <Textarea
                        {...field}
                        placeholder="ספר על עצמך, הרקע שלך, והניסיון שלך בשדכנות"
                        rows={5}
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormGrid>
                  <FormField
                    control={form.control}
                    name="experience_years"
                    render={({ field }) => (
                      <FormFieldShell label="שנות ניסיון" required>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          placeholder="לדוגמה: 5"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="closed_matches"
                    render={({ field }) => (
                      <FormFieldShell label="כמה שידוכים סגרתי" required>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          placeholder="לדוגמה: 12"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />
                </FormGrid>

                <FormField
                  control={form.control}
                  name="specializations"
                  render={({ field }) => (
                    <FormFieldShell
                      label="התמחויות"
                      description="מופרדות בפסיקים"
                    >
                      <Input
                        {...field}
                        placeholder="לדוגמה: שידוכים צעירים, שידוכים מבוגרים"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormGrid>
                  <FormField
                    control={form.control}
                    name="contact_phone"
                    render={({ field }) => (
                      <FormFieldShell label="טלפון ליצירת קשר">
                        <Input
                          {...field}
                          type="tel"
                          placeholder="+972 50…"
                          autoComplete="tel"
                          dir="ltr"
                          className="text-start"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contact_email"
                    render={({ field }) => (
                      <FormFieldShell label="אימייל ליצירת קשר">
                        <Input
                          {...field}
                          type="email"
                          placeholder="contact@example.com"
                          autoComplete="email"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />
                </FormGrid>

                <FormField
                  control={form.control}
                  name="languages"
                  render={({ field }) => (
                    <FormFieldShell label="שפות" description="מופרדות בפסיקים">
                      <Input
                        {...field}
                        placeholder="לדוגמה: עברית, אנגלית, יידיש"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormActions>
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={isSubmitting}
                  >
                    <Link href="/app/settings">ביטול</Link>
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
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
