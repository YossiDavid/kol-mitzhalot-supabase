"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveContactEmail } from "@/app/app/admin/settings/contact-email-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_EMAIL_MESSAGES,
  contactEmailSchema,
} from "@/features/contact-email/lib/contact-email-model";

/** טופס הגדרת "אימייל ליצירת קשר". ריק = בלי שורה בתחתית */
export function ContactEmailForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSave = () => {
    const parsed = contactEmailSchema.safeParse(email);
    if (!parsed.success) {
      setError(CONTACT_EMAIL_MESSAGES.invalid);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveContactEmail(parsed.data);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setEmail(result.email);
      setSavedEmail(result.email);
      toast.success(
        result.email
          ? CONTACT_EMAIL_MESSAGES.saved
          : CONTACT_EMAIL_MESSAGES.cleared,
      );
    });
  };

  return (
    <Card className="gap-3">
      <div className="space-y-1 text-right">
        <Label
          htmlFor="contact-email-input"
          className="text-body font-semibold"
        >
          אימייל ליצירת קשר
        </Label>
        <p className="text-body-sm text-muted-foreground">
          מוצג בתחתית כל דף באתר ובאפליקציה, עם כפתור העתקה. השאירו ריק כדי לא
          להציג.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1 space-y-1">
          <Input
            id="contact-email-input"
            type="email"
            dir="ltr"
            className="text-start"
            placeholder="info@example.com"
            autoComplete="off"
            maxLength={CONTACT_EMAIL_MAX_LENGTH}
            value={email}
            disabled={isPending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "contact-email-error" : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? (
            <p
              id="contact-email-error"
              role="alert"
              className="text-body-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={onSave}
          disabled={isPending || email.trim() === savedEmail}
        >
          {isPending ? "שומר..." : "שמירה"}
        </Button>
      </div>
    </Card>
  );
}
