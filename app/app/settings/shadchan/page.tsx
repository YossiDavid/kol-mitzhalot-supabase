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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { isValidILPhone } from "@/lib/phone";

interface ShadchanFormData {
  bio: string;
  experience_years: string;
  specializations: string;
  contact_phone: string;
  contact_email: string;
  website_url: string;
  location: string;
  languages: string;
  certifications: string;
}

export default function ShadchanApplicationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [existingApplication, setExistingApplication] = useState<any>(null);

  const form = useForm<ShadchanFormData>({
    defaultValues: {
      bio: "",
      experience_years: "",
      specializations: "",
      contact_phone: "",
      contact_email: "",
      website_url: "",
      location: "",
      languages: "",
      certifications: "",
    },
  });

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
      const role = user.user_metadata?.role;
      if (role === "shadchan" || role === "admin") {
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
          website_url: data.website_url || "",
          location: data.location || "",
          languages: Array.isArray(data.languages)
            ? data.languages.join(", ")
            : data.languages || "",
          certifications: Array.isArray(data.certifications)
            ? data.certifications.join(", ")
            : data.certifications || "",
        });
      }

      setIsFetching(false);
    }

    fetchExistingData();
  }, [router, form]);

  const onSubmit = async (data: ShadchanFormData) => {
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

      // בדיקת טלפון אם הוזן
      if (data.contact_phone && !isValidILPhone(data.contact_phone.trim())) {
        toast.error("מספר טלפון לא תקין. השתמש בפורמט 05XXXXXXXX או 9725XXXXXXXX");
        setIsLoading(false);
        return;
      }

      // הכנת הנתונים להכנסה
      const insertData: any = {
        user_id: user.id,
        bio: data.bio || null,
        experience_years: data.experience_years
          ? parseInt(data.experience_years)
          : null,
        specializations: data.specializations
          ? data.specializations.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        contact_phone: data.contact_phone || null,
        contact_email: data.contact_email || null,
        website_url: data.website_url || null,
        location: data.location || null,
        languages: data.languages
          ? data.languages.split(",").map((l) => l.trim()).filter(Boolean)
          : null,
        certifications: data.certifications
          ? data.certifications.split(",").map((c) => c.trim()).filter(Boolean)
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
        error instanceof Error
          ? error.message
          : "אירעה שגיאה בשליחת הבקשה";
      toast.error(errorMessage);
      console.error("Error submitting shadchan application:", error);
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
          <h1 className="text-3xl font-bold">הצטרפות כשדכן</h1>
          <p className="text-muted-foreground mt-2">
            מלא את הפרטים הבאים כדי להגיש בקשה להצטרפות כשדכן במערכת
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
                  name="bio"
                  rules={{ required: "ביוגרפיה היא שדה חובה" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ביוגרפיה</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="ספר על עצמך, הרקע שלך, והניסיון שלך בשדכנות"
                          rows={5}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="experience_years"
                  rules={{ required: "שנות ניסיון הן שדה חובה" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שנות ניסיון</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          placeholder="לדוגמה: 5"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="specializations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>התמחויות (מופרדות בפסיקים)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="לדוגמה: שידוכים צעירים, שידוכים מבוגרים"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="contact_phone"
                  rules={{
                    validate: (v) =>
                      !v?.trim() ||
                      isValidILPhone(v.trim()) ||
                      "פורמט: 05XXXXXXXX או 9725XXXXXXXX",
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>טלפון ליצירת קשר</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          placeholder="05XXXXXXXX"
                          dir="ltr"
                          className="text-left"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="contact_email"
                  rules={{
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "אימייל לא תקין",
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>אימייל ליצירת קשר</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="contact@example.com"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="website_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>כתובת אתר (אופציונלי)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="url"
                          placeholder="https://example.com"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>מיקום (אופציונלי)</FormLabel>
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
                  name="languages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שפות (מופרדות בפסיקים, אופציונלי)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="לדוגמה: עברית, אנגלית, יידיש"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="certifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>תעודות והסמכות (מופרדות בפסיקים, אופציונלי)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="לדוגמה: הסמכה רבנית, תעודת שדכן"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 justify-end">
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
