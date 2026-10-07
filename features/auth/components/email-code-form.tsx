"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormFields, FormSubmitError } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { verifyEmailCodeAction } from "@/features/auth/actions/verify-email-code";
import { normalizeEmailCode } from "@/features/auth/lib/email-auth-schema";
import { readLastEmail } from "@/features/auth/lib/last-email";
import { requiredEmail, requiredText } from "@/lib/forms/schema";

const CODE_MIN_LENGTH = 6;
const CODE_MAX_LENGTH = 10;

const codeSchema = z.object({
  email: requiredEmail("אימייל"),
  code: requiredText("קוד")
    .transform(normalizeEmailCode)
    .pipe(
      z
        .string()
        .regex(
          new RegExp(`^\\d{${CODE_MIN_LENGTH},${CODE_MAX_LENGTH}}$`),
          "הקוד מורכב מ-6 ספרות",
        ),
    ),
});

type CodeInput = z.input<typeof codeSchema>;
type CodeValues = z.output<typeof codeSchema>;

/**
 * "הזנת קוד מהמייל": הקוד בן הספרות שמופיע באותו מייל שבו הקישור. חלופה
 * לקישור כשסורק קישורים צרך אותו מראש — הקוד אינו כתובת, ולכן אי אפשר לצרוך
 * אותו בלי שמישהו מקליד אותו.
 */
export function EmailCodeForm({
  next = null,
  email: initialEmail = "",
}: {
  /** היעד אחרי הכניסה; מסונן שוב בצד השרת */
  next?: string | null;
  email?: string;
}) {
  const form = useForm<CodeInput, unknown, CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email: initialEmail, code: "" },
  });

  const { isSubmitting, errors } = form.formState;

  // האימייל האחרון נקרא אחרי ההידרציה: localStorage לא קיים בשרת, וקריאה
  // מוקדמת הייתה יוצרת פער בין ה-HTML לצד הלקוח
  useEffect(() => {
    if (form.getValues("email")) return;
    const stored = readLastEmail();
    if (stored) form.setValue("email", stored);
  }, [form]);

  const onSubmit = async ({ email, code }: CodeValues) => {
    form.clearErrors("root");
    const result = await verifyEmailCodeAction({ email, code, next });
    // הצלחה מפנה מהשרת ואינה חוזרת לכאן
    if (result && !result.ok) {
      form.setError("root", { message: result.message });
    }
  };

  return (
    <section
      aria-labelledby="email-code-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="email-code-heading" className="text-body font-semibold">
        הזנת קוד מהמייל
      </h2>
      <p className="text-body-sm text-muted-foreground">
        באותו מייל מופיע גם קוד בן 6 ספרות. הקלידו אותו כאן כדי להיכנס בלי
        הקישור.
      </p>
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
                    autoComplete="email"
                    dir="ltr"
                    className="text-start"
                    disabled={isSubmitting}
                  />
                </FormFieldShell>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormFieldShell label="הקוד בן 6 הספרות" required>
                  <Input
                    {...field}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    maxLength={CODE_MAX_LENGTH + 2}
                    dir="ltr"
                    className="text-start tracking-widest"
                    disabled={isSubmitting}
                  />
                </FormFieldShell>
              )}
            />
            <FormSubmitError>{errors.root?.message}</FormSubmitError>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "מאמת..." : "כניסה עם הקוד"}
            </Button>
          </FormFields>
        </form>
      </Form>
    </section>
  );
}
