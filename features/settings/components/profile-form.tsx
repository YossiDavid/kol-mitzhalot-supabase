"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormFields, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  requiredEmail,
  requiredPhone,
  requiredText,
} from "@/lib/forms/schema";
import { normalizePhoneKey } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_NEXT_PATH,
  sanitizeNextPath,
  withNextParam,
} from "@/features/auth/lib/next-path";

const profileSchema = z.object({
  firstName: requiredText("שם פרטי"),
  lastName: requiredText("שם משפחה"),
  email: requiredEmail("אימייל"),
  phone: requiredPhone("מספר טלפון"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialData: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
  /** When false, phone changes do not require OTP or verify-phone redirect */
  phoneVerificationEnabled?: boolean;
  /**
   * היעד שאליו לחזור אחרי שמירה מוצלחת. מגיע משער הזיהוי
   * (lib/name-gate.ts) כשהמשתמש נשלח לכאן באמצע מסע אחר - למשל קישור
   * להצעת שידוך ממייל. כשהוא ברירת המחדל, המשתמש פשוט נשאר בהגדרות.
   */
  next?: string;
}

export function ProfileForm({
  initialData,
  phoneVerificationEnabled = true,
  next = DEFAULT_NEXT_PATH,
}: ProfileFormProps) {
  const router = useRouter();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: initialData.firstName || "",
      lastName: initialData.lastName || "",
      email: initialData.email || "",
      phone: initialData.phone || "",
    },
  });

  const { isSubmitting } = form.formState;

  // הערכים מגיעים כבר חתוכי רווחים מהסכמה (trim), ותקינות הטלפון והאימייל
  // נבדקה לפני שהגענו לכאן
  const onSubmit = async (data: ProfileFormData) => {
    const supabase = createClient();

    const phoneChanged =
      normalizePhoneKey(initialData.phone || "") !==
      normalizePhoneKey(data.phone);

    try {
      const updateData: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
      };

      if (phoneChanged) {
        updateData.phone = data.phone;
        if (phoneVerificationEnabled) {
          updateData.phone_verified = false;
          updateData.phone_confirmed_at = null;
        } else {
          updateData.phone_verified = true;
          updateData.phone_confirmed_at = new Date().toISOString();
        }
      }

      const { error } = await supabase.auth.updateUser({
        data: updateData,
        email: data.email !== initialData.email ? data.email : undefined,
      });

      if (error) throw error;

      toast.success("הפרופיל עודכן בהצלחה");
      router.refresh();

      const target = sanitizeNextPath(next);

      if (phoneChanged && phoneVerificationEnabled) {
        toast.info("הטלפון שונה – נדרש אימות מחדש");
        router.push(withNextParam("/auth/verify-phone", target));
        return;
      }

      // שער הזיהוי שלח לכאן באמצע מסע אחר - מחזירים אליו
      if (target !== DEFAULT_NEXT_PATH) {
        router.push(target);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "אירעה שגיאה בעדכון הפרופיל";
      toast.error(errorMessage);
      console.error("Error updating profile:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>פרטים אישיים</CardTitle>
        <CardDescription>עדכן את פרטי הפרופיל שלך</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FormFields>
              <FormGrid>
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormFieldShell label="שם פרטי" required>
                      <Input
                        {...field}
                        placeholder="הכנס שם פרטי"
                        autoComplete="given-name"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormFieldShell label="שם משפחה" required>
                      <Input
                        {...field}
                        placeholder="הכנס שם משפחה"
                        autoComplete="family-name"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />
              </FormGrid>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormFieldShell label="אימייל" required>
                    <Input
                      {...field}
                      type="email"
                      placeholder="הכנס אימייל"
                      autoComplete="email"
                      disabled={isSubmitting}
                    />
                  </FormFieldShell>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormFieldShell label="מספר טלפון" required>
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

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "שומר..." : "שמור שינויים"}
              </Button>
            </FormFields>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
