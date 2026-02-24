import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

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
  handleSubmit,
  channel = "email",
  error,
  onResend,
  ...props
}: React.ComponentProps<typeof Card> & {
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  channel?: "email" | "phone";
  error?: string | null;
  onResend?: () => void;
}) {
  const c = copy[channel];

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => handleSubmit(e)}>
          <FieldGroup>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="otp">קוד אימות</FieldLabel>
              <InputOTP maxLength={5} id="otp" name="otp" required>
                <InputOTPGroup className="gap-2.5 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border">
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                </InputOTPGroup>
              </InputOTP>
              <FieldDescription>{c.fieldDesc}</FieldDescription>
            </Field>
            <FieldGroup>
              <Button type="submit">אימות</Button>
              <FieldDescription className="text-center">
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
              </FieldDescription>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
