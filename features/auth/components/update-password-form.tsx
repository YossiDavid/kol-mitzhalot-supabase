"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { requiredText } from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// אורך הסיסמה נאכף ב-Supabase, ולכן כאן נבדק רק שהשדה לא ריק
const updatePasswordSchema = z.object({
  password: requiredText("סיסמה חדשה"),
});

type UpdatePasswordValues = z.infer<typeof updatePasswordSchema>;

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();

  const form = useForm<UpdatePasswordValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "" },
  });

  const { isSubmitting, errors } = form.formState;

  const onSubmit = async ({ password }: UpdatePasswordValues) => {
    form.clearErrors("root");
    const supabase = createClient();

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Redirect to the main app dashboard after password update
      router.push("/app");
    } catch (error: unknown) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <PageTitle>שחזר את הסיסמה שלך</PageTitle>
          <CardDescription>הכנס את הסיסמה החדשה שלך שמטה.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FormFields>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormFieldShell label="סיסמה חדשה" required>
                      <Input
                        {...field}
                        type="password"
                        placeholder="סיסמה חדשה"
                        autoComplete="new-password"
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
                  {isSubmitting ? "שומר..." : "שמור סיסמה חדשה"}
                </Button>
              </FormFields>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
