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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import Link from "next/link";
import {
  INSTITUTION_TYPE_LABELS,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";

interface StaffFormData {
  institutionId: string;
  city: string;
  position: string;
}

interface ExistingStaffApplication {
  institution_id: string | null;
  city: string | null;
  position: string | null;
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
      institutionId: "",
      city: "",
      position: "",
    },
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
      const role = user.user_metadata?.role;
      if (role === "staff" || role === "admin") {
        router.push("/app/settings");
        return;
      }

      // שליפת מידע קיים אם יש
      const { data, error } = await supabase
        .from("staff_info")
        .select("institution_id, city, position, application_status")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching existing application:", error);
      }

      if (data) {
        setExistingApplication(data);
        // מילוי הטופס עם הנתונים הקיימים
        form.reset({
          institutionId: data.institution_id || "",
          city: data.city || "",
          position: data.position || "",
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

      // הכנת הנתונים להכנסה
      const insertData = {
        user_id: user.id,
        institution_id: data.institutionId || null,
        city: data.city || null,
        position: data.position || null,
        ...(existingApplication
          ? {}
          : {
              application_status: "pending" as const,
              submitted_at: new Date().toISOString(),
            }),
      };

      // upsert לפי user_id
      const { error } = await supabase.from("staff_info").upsert(insertData, {
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
            מלא את הפרטים הבאים כדי להגיש בקשה להצטרפות כאיש צוות במערכת
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
                <FormField
                  control={form.control as any}
                  name="institutionId"
                  rules={{ required: "מוסד לימודים הוא שדה חובה" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>מוסד לימודים</FormLabel>
                      {institutionsError ? (
                        <p className="text-body-sm text-destructive">
                          {institutionsError}
                        </p>
                      ) : !isInstitutionsLoading &&
                        institutions.length === 0 ? (
                        <p className="text-body-sm text-muted-foreground">
                          לא הוגדרו עדיין מוסדות לימוד במערכת. נא לפנות למנהל
                          המערכת כדי להוסיף את המוסד שלכם לרשימה.
                        </p>
                      ) : (
                        <>
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
                        </>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="city"
                  rules={{ required: "עיר היא שדה חובה" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>עיר</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="לדוגמה: ירושלים"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="position"
                  rules={{ required: "תפקיד הוא שדה חובה" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>תפקיד</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="לדוגמה: משגיח, מחנכת"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
