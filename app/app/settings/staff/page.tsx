"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { toast } from "sonner";
import { useFieldArray, useForm } from "react-hook-form";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import {
  INSTITUTION_TYPE_LABELS,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";
import { hasRole } from "@/lib/user-role";

/** שיוך יחיד: מוסד ותפקיד באותו מוסד */
interface StaffInstitutionEntry {
  institutionId: string;
  position: string;
}

interface StaffFormData {
  institutions: StaffInstitutionEntry[];
}

interface ExistingStaffApplication {
  application_status: "pending" | "approved" | "rejected" | null;
}

interface InstitutionOption {
  id: string;
  name: string;
  city: string | null;
  type: InstitutionType;
}

export default function StaffApplicationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [existingApplication, setExistingApplication] =
    useState<ExistingStaffApplication | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [isInstitutionsLoading, setIsInstitutionsLoading] = useState(true);
  const [institutionsError, setInstitutionsError] = useState<string | null>(
    null,
  );

  const form = useForm<StaffFormData>({
    defaultValues: {
      institutions: [{ institutionId: "", position: "" }],
    },
  });

  const institutionFields = useFieldArray({
    control: form.control,
    name: "institutions",
  });

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
    setIsLoading(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("יש להתחבר למערכת");
        setIsLoading(false);
        return;
      }

      const entries = data.institutions.filter((e) => e.institutionId);
      if (entries.length === 0) {
        toast.error("יש לבחור לפחות מוסד לימודים אחד");
        setIsLoading(false);
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
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center">טוען...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-heading font-bold">הצטרפות כאיש צוות</h1>
          <p className="mt-2 text-muted-foreground">
            ההצטרפות כאיש צוות נועדה לכתיבת משוב חיובי על כרטיסי המיועדים
            שמתחנכים אצלכם — מחמאות ותשבחות שיעזרו לשדכנים להכיר אותם טוב יותר.
            מלאו את המוסדות שבהם אתם מלמדים ואת התפקיד בכל אחד מהם.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>טופס הצטרפות</CardTitle>
            <CardDescription>
              אנא מלא את כל הפרטים הרלוונטיים. הבקשה תבדק על ידי מנהל המערכת.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
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
                        className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start"
                      >
                        <FormField
                          control={form.control as any}
                          name={`institutions.${index}.institutionId`}
                          rules={{ required: "יש לבחור מוסד לימודים" }}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <NativeSelect
                                  {...field}
                                  disabled={isLoading || isInstitutionsLoading}
                                >
                                  <NativeSelectOption value="" disabled>
                                    {isInstitutionsLoading
                                      ? "טוען מוסדות..."
                                      : "בחר/י מוסד לימודים"}
                                  </NativeSelectOption>
                                  {institutions.map((institution) => (
                                    <NativeSelectOption
                                      key={institution.id}
                                      value={institution.id}
                                    >
                                      {`${institution.name}${institution.city ? ` · ${institution.city}` : ""} · ${INSTITUTION_TYPE_LABELS[institution.type]}`}
                                    </NativeSelectOption>
                                  ))}
                                </NativeSelect>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control as any}
                          name={`institutions.${index}.position`}
                          rules={{ required: "תפקיד הוא שדה חובה" }}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="תפקיד — לדוגמה: משגיח, מחנכת"
                                  disabled={isLoading}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground"
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
                </div>

                <div className="flex justify-end gap-2">
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
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
