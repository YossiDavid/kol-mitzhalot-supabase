"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { requiredText } from "@/lib/forms/schema";

/** אורך הקוד ששולחת המערכת, לאימייל ולטלפון */
const OTP_LENGTH = 5;

const OTP_SLOTS = Array.from({ length: OTP_LENGTH }, (_, index) => index);

const otpSchema = z.object({
  otp: requiredText("קוד אימות").regex(
    new RegExp(`^\\d{${OTP_LENGTH}}$`),
    `הקוד בן ${OTP_LENGTH} ספרות`,
  ),
});

type OtpValues = z.infer<typeof otpSchema>;

const copy = {
  email: {
    title: "הזן קוד אימות",
    description: "הקוד נשלח אליך באימייל.",
    fieldDesc: "הקש את הקוד שנשלח לאימייל.",
    resend: "לא קיבלת? שלח שוב",
  },
  phone: {
    title: "הזן קוד אימות",
    description: "הקוד נשלח למספר הטלפון שלך.",
    fieldDesc: "הקש את הקוד שנשלח לטלפון.",
    resend: "לא קיבלת? שלח שוב",
  },
};

export function OTPForm({
  onSubmit,
  channel = "email",
  error,
  onResend,
  ...props
}: Omit<React.ComponentProps<typeof Card>, "onSubmit"> & {
  /** מקבל את הקוד שהוקלד, אחרי שעבר ולידציה */
  onSubmit: (otp: string) => void | Promise<void>;
  channel?: "email" | "phone";
  /** שגיאה מהשרת: שליחת הקוד או האימות נכשלו */
  error?: string | null;
  onResend?: () => void;
}) {
  const c = copy[channel];

  const form = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  const { isSubmitting } = form.formState;

  return (
    <Card {...props}>
      <CardHeader>
        <PageTitle>{c.title}</PageTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
          <form
            onSubmit={form.handleSubmit((values) => onSubmit(values.otp))}
            noValidate
          >
            <FormFields>
              <FormSubmitError>{error}</FormSubmitError>
              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormFieldShell
                    label="קוד אימות"
                    required
                    description={c.fieldDesc}
                    htmlFor="otp"
                  >
                    {/* InputOTP שומר על ההדבקה ועל autocomplete="one-time-code" */}
                    <InputOTP
                      id="otp"
                      name={field.name}
                      maxLength={OTP_LENGTH}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      disabled={isSubmitting}
                    >
                      <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                        {OTP_SLOTS.map((index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </FormFieldShell>
                )}
              />
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "מאמת..." : "אימות"}
              </Button>
              <p className="text-center text-body-sm text-muted-foreground">
                {onResend ? (
                  <button
                    type="button"
                    onClick={onResend}
                    className="text-primary underline underline-offset-4"
                  >
                    {c.resend}
                  </button>
                ) : (
                  c.resend
                )}
              </p>
            </FormFields>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
