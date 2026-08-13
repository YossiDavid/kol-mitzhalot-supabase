"use client";

/**
 * Callers: website Footer variant="website".
 * API: subscribeNewsletter server action → newsletter_subscribers.
 * User: "6. כרגע צריך לחבר אותו לטבלה ב db עד שנחבר אותו למסוף ניוזלטרים."
 */

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  subscribeNewsletter,
  type FormActionResult,
} from "@/app/(website)/actions/public-forms";

const initial: FormActionResult | null = null;

export function NewsletterSignup() {
  const [state, action, pending] = useActionState(subscribeNewsletter, initial);

  if (state?.ok) {
    return (
      <p className="text-body-sm font-semibold text-primary" role="status">
        נרשמתם בהצלחה לרשימת התפוצה.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <Input
        type="email"
        name="email"
        required
        placeholder="כתובת מייל"
        autoComplete="email"
        aria-label="כתובת מייל לרשימת תפוצה"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "נרשמים..." : "הרשמה"}
      </Button>
      {state && !state.ok ? (
        <p className="text-caption text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
