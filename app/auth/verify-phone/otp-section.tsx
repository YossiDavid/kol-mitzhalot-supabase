"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
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
import { OTPForm } from "@/features/auth/components/otp-form";
import { requiredText } from "@/lib/forms/schema";
import { isValidPhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_NEXT_PATH,
  sanitizeNextPath,
} from "@/features/auth/lib/next-path";

const addPhoneSchema = z.object({
  // הרווחים מוסרים לפני הבדיקה ולפני השמירה, כמו קודם
  phone: requiredText("מספר טלפון")
    .transform((value) => value.replace(/\s/g, ""))
    .refine(isValidPhone, PHONE_INVALID_MESSAGE),
});

type AddPhoneValues = z.infer<typeof addPhoneSchema>;

interface OTPSectionProps {
  hasPhone?: boolean;
  maskedPhone?: string | null;
  /** לאן לחזור אחרי אימות מוצלח - היעד שהמשתמש ניסה להגיע אליו */
  next?: string;
}

export default function OTPSection({
  hasPhone = true,
  maskedPhone = null,
  next = DEFAULT_NEXT_PATH,
}: OTPSectionProps) {
  const [codeSent, setCodeSent] = useState(false);
  const [addedPhone, setAddedPhone] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const showAddPhone = !hasPhone && !addedPhone;

  const phoneForm = useForm<AddPhoneValues>({
    resolver: zodResolver(addPhoneSchema),
    defaultValues: { phone: "" },
  });

  const handleAddPhone = async ({ phone }: AddPhoneValues) => {
    phoneForm.clearErrors("root");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { phone },
      });
      if (error) throw error;
      setAddedPhone(true);
    } catch (err) {
      phoneForm.setError("root", {
        message: err instanceof Error ? err.message : "שגיאה בשמירת הטלפון",
      });
    }
  };

  const handleSendCode = async () => {
    setSendError(null);
    const response = await fetch("/api/v1/auth/otp/send", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setSendError(null);
      setCodeSent(true);
    } else {
      setSendError(data?.message || "שגיאה בשליחת הקוד");
    }
  };

  const handleVerify = async (otp: string) => {
    setSendError(null);

    const response = await fetch("/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp }),
    });

    if (response.ok) {
      // ניווט מלא ולא router.push: הסשן השתנה בשרת, ורענון מלא מוודא
      // שהעמוד הבא נטען עם המשתמש המאומת.
      window.location.href = sanitizeNextPath(next);
      return;
    }

    const data = await response.json().catch(() => ({}));
    setSendError(data?.message || "אימות נכשל");
  };

  if (showAddPhone) {
    const { isSubmitting, errors } = phoneForm.formState;

    return (
      <Card>
        <CardHeader>
          <PageTitle>הוספת מספר טלפון</PageTitle>
          <CardDescription>
            נדרש מספר טלפון לאימות. הזן את המספר שלך.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...phoneForm}>
            {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
            <form
              onSubmit={phoneForm.handleSubmit(handleAddPhone)}
              noValidate
            >
              <FormFields>
                <FormField
                  control={phoneForm.control}
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
                <FormSubmitError>{errors.root?.message}</FormSubmitError>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "שומר..." : "המשך"}
                </Button>
              </FormFields>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  if (codeSent) {
    return (
      <div className="space-y-4">
        <OTPForm
          onSubmit={handleVerify}
          channel="phone"
          error={sendError}
          onResend={handleSendCode}
        />
        <p className="text-center text-body-sm text-muted-foreground">
          <Link href="/app/settings" className="underline hover:text-foreground">
            זה לא המספר שלי? לעדכון
          </Link>
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <PageTitle>אימות מספר הטלפון</PageTitle>
        <CardDescription>
          {maskedPhone ? (
            <>
              נשלח קוד אימות ל-<span dir="ltr">{maskedPhone}</span>. לחץ לשליחה.
            </>
          ) : (
            "נשלח אליך קוד אימות (SMS או הודעה קולית). לחץ לשליחה."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <FormSubmitError>{sendError}</FormSubmitError>
          <Button onClick={handleSendCode} className="w-full">
            שלח קוד אימות
          </Button>
          {maskedPhone && (
            <p className="text-center text-body-sm text-muted-foreground">
              <Link
                href="/app/settings"
                className="underline hover:text-foreground"
              >
                זה לא המספר שלי? לעדכון
              </Link>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
