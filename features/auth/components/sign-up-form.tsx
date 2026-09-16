"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageTitle } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import {
  FormFields,
  FormGrid,
  FormSubmitError,
} from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  AUTH_CONFIRM_PATH,
  getAuthRedirectUrl,
} from "@/features/auth/lib/redirect-url";
import { requiredEmail, requiredText } from "@/lib/forms/schema";
import { isValidPhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const signUpSchema = z.object({
  firstName: requiredText("שם פרטי"),
  lastName: requiredText("שם משפחה"),
  email: requiredEmail("אימייל"),
  // הרווחים מוסרים לפני הבדיקה ולפני השמירה, כמו קודם
  phone: requiredText("מספר טלפון")
    .transform((value) => value.replace(/\s/g, ""))
    .refine(isValidPhone, PHONE_INVALID_MESSAGE),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "" },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async (values: SignUpValues) => {
    form.clearErrors("root");
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          data: {
            phone: values.phone,
            firstName: values.firstName,
            lastName: values.lastName,
          },
          emailRedirectTo: getAuthRedirectUrl(AUTH_CONFIRM_PATH),
        },
      });
      if (error) throw error;
      router.push("/auth/check-email");
    } catch (err: unknown) {
      form.setError("root", {
        message: err instanceof Error ? err.message : "אירעה שגיאה",
      });
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <PageTitle>הרשמה</PageTitle>
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
                          type="text"
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
                          type="text"
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
                        placeholder="m@example.com"
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
                    <FormFieldShell
                      label="מספר טלפון"
                      required
                      description="מספר בינלאומי? הזינו עם קידומת מדינה (+…)"
                    >
                      <Input
                        {...field}
                        type="tel"
                        placeholder="05X-XXX-XXXX"
                        autoComplete="tel"
                        dir="ltr"
                        className="text-start"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormSubmitError>{errors.root?.message}</FormSubmitError>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "יצירת חשבון..." : "הירשם"}
                </Button>
              </FormFields>
              <div className="mt-4 text-center text-body-sm text-muted-foreground">
                יש לך חשבון?{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  התחבר
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
