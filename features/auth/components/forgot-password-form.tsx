"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageTitle } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormFields, FormSubmitError } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  AUTH_UPDATE_PASSWORD_PATH,
  getAuthRedirectUrl,
} from "@/features/auth/lib/redirect-url";
import { requiredEmail } from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const forgotPasswordSchema = z.object({
  email: requiredEmail("אימייל"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const { isSubmitting, isSubmitSuccessful, errors } = form.formState;
  // שליחה שנכשלה מסומנת ב-root, ולכן "הצלחה" היא שליחה שהסתיימה בלעדיה
  const isSuccess = isSubmitSuccessful && !errors.root;

  const onSubmit = async ({ email }: ForgotPasswordValues) => {
    form.clearErrors("root");
    const supabase = createClient();

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl(AUTH_UPDATE_PASSWORD_PATH),
      });
      if (error) throw error;
    } catch (error: unknown) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {isSuccess ? (
        <Card>
          <CardHeader>
            <PageTitle>בדוק את האימייל שלך</PageTitle>
            <CardDescription>
              נשלחה לך מייל עם פקודות שחזור סיסמה
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-body-sm text-muted-foreground">
              אם הירשמת באמצעות האימייל והסיסמה, תקבל מייל עם פקודות שחזור
              סיסמה.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <PageTitle>שחזר את הסיסמה שלך</PageTitle>
            <CardDescription>
              הכנס את האימייל שלך ונשלח לך קישור לשחזור הסיסמה שלך
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                <FormFields>
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
                  <FormSubmitError>{errors.root?.message}</FormSubmitError>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "שולח..." : "שלח מייל שחזור סיסמה"}
                  </Button>
                </FormFields>
                <div className="mt-4 text-center text-body-sm">
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
      )}
    </div>
  );
}
