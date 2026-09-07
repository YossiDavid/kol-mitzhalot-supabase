"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  AUTH_CONFIRM_PATH,
  getAuthRedirectUrl,
} from "@/features/auth/lib/redirect-url";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // התחברות בלבד. בלי זה Supabase יוצר חשבון חדש לכל אימייל שמוקלד
          // כאן ומדלג על טופס ההרשמה — כלומר משתמש בלי שם ובלי טלפון.
          shouldCreateUser: false,
          emailRedirectTo: getAuthRedirectUrl(AUTH_CONFIRM_PATH),
        },
      });
      if (error) throw error;
      router.push("/auth/check-email");
    } catch (err: unknown) {
      setError(resolveLoginError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-heading">התחברות</CardTitle>
          <CardDescription>
            הכנס את האימייל שלך ונשלח אליך קישור להתחברות (Magic Link)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email" required>
                  אימייל
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {error && (
                <p className="text-body-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "שולח קישור..." : "שלח קישור התחברות"}
              </Button>
            </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
