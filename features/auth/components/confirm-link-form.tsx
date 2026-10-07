"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { confirmEmailLinkAction } from "@/features/auth/actions/confirm-email-link";

type ConfirmLinkFormProps = {
  tokenHash: string | null;
  type: string | null;
  code: string | null;
  next: string;
  /** הנוסח של הכפתור והסבר קצר, לפי הרשמה/התחברות */
  buttonLabel: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "מתחברים..." : label}
    </Button>
  );
}

/**
 * הכפתור שצורך את הקישור. האימות נעשה רק ב-submit (server action), לא בטעינת
 * הדף — כדי שסורק קישורים שמבקש את הכתובת לא יבזבז אותה.
 */
export function ConfirmLinkForm({
  tokenHash,
  type,
  code,
  next,
  buttonLabel,
}: ConfirmLinkFormProps) {
  return (
    <form action={confirmEmailLinkAction}>
      {tokenHash ? (
        <input type="hidden" name="token_hash" value={tokenHash} />
      ) : null}
      {type ? <input type="hidden" name="type" value={type} /> : null}
      {code ? <input type="hidden" name="code" value={code} /> : null}
      <input type="hidden" name="next" value={next} />
      <SubmitButton label={buttonLabel} />
    </form>
  );
}
