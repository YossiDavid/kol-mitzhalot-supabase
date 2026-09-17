"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  buildConfirmPath,
  getAuthRedirectUrl,
} from "@/features/auth/lib/redirect-url";
import { requiredEmail } from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: requiredEmail("אימייל"),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * כשהאימייל לא קיים, Supabase מחזיר "Signups not allowed for otp" —
 * הודעה מבלבלת בדף התחברות. מתרגמים אותה להנחיה להירשם.
 */
function resolveLoginError(err: unknown): string {
  if (!(err instanceof Error)) return "אירעה שגיאה";
  const code = (err as { code?: string }).code;
  if (code === "otp_disabled" || /signups not allowed/i.test(err.message)) {
    return "לא נמצא חשבון עם האימייל הזה. יש להירשם תחילה.";
  }
  return err.message;
}

export function LoginForm({
  className,
  next = null,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  /** היעד שאליו לחזור אחרי ההתחברות, כשההגעה לכאן הייתה מקישור עמוק */
  next?: string | null;
}) {
  const router = useRouter();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async ({ email }: LoginValues) => {
    form.clearErrors("root");
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // התחברות בלבד. בלי זה Supabase יוצר חשבון חדש לכל אימייל שמוקלד
          // כאן ומדלג על טופס ההרשמה — כלומר משתמש בלי שם ובלי טלפון.
          shouldCreateUser: false,
          emailRedirectTo: getAuthRedirectUrl(buildConfirmPath(next)),
        },
      });
      if (error) throw error;
      router.push("/auth/check-email");
    } catch (err: unknown) {
      form.setError("root", { message: resolveLoginError(err) });
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <PageTitle>התחברות</PageTitle>
          <CardDescription>
            הכנס את האימייל שלך ונשלח אליך קישור להתחברות (Magic Link)
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
                  {isSubmitting ? "שולח קישור..." : "שלח קישור התחברות"}
                </Button>
              </FormFields>
              <div className="mt-4 text-center text-body-sm text-muted-foreground">
                אין לך חשבון?{" "}
                <Link
                  href="/auth/sign-up"
                  className="underline underline-offset-4"
                >
                  הירשם
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
