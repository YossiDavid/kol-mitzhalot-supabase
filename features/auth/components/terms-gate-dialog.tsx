"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { acceptTerms } from "@/features/auth/actions/accept-terms";
import {
  TERMS_CHECKBOX_LABEL,
  TERMS_PAGE_PATH,
} from "@/features/auth/lib/terms";
import { createClient } from "@/lib/supabase/client";

interface TermsGateDialogProps {
  version: number;
  title: string;
  /** HTML מעורך התוכן של המנהל (אותו תוכן כמו בדף /legal) */
  content: string;
}

/** הדיאלוג לא נסגר: לא ב-Esc, לא בלחיצה בחוץ ואין כפתור סגירה */
const preventClose = (event: Event) => event.preventDefault();

/**
 * חסימת /app עד אישור התקנון (וגם אחרי שפורסמה גרסה חדשה). הדרכים היחידות
 * החוצה: לאשר, או להתנתק.
 */
export function TermsGateDialog({
  version,
  title,
  content,
}: TermsGateDialogProps) {
  const router = useRouter();
  const checkboxId = useId();
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptTerms(version);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Dialog open>
      <DialogContent
        size="lg"
        showCloseButton={false}
        onEscapeKeyDown={preventClose}
        onPointerDownOutside={preventClose}
        onInteractOutside={preventClose}
        data-testid="terms-gate-dialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            כדי להמשיך להשתמש במערכת יש לקרוא ולאשר את התקנון.
          </DialogDescription>
        </DialogHeader>

        <div
          className="max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-muted/30 p-4 text-body-sm"
          tabIndex={0}
          aria-label="תוכן התקנון"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        <Link
          href={TERMS_PAGE_PATH}
          target="_blank"
          className="flex w-fit items-center gap-1.5 text-body-sm underline underline-offset-4"
        >
          <ExternalLink className="size-4" aria-hidden />
          פתיחת התקנון בחלון חדש
        </Link>

        <div className="flex items-center gap-3">
          <Checkbox
            id={checkboxId}
            checked={isChecked}
            onCheckedChange={(checked) => setIsChecked(checked === true)}
            disabled={isPending}
          />
          <Label htmlFor={checkboxId} className="cursor-pointer font-semibold">
            {TERMS_CHECKBOX_LABEL}
          </Label>
        </div>

        {error && (
          <p role="alert" className="text-body-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            disabled={isPending}
          >
            התנתקות
          </Button>
          <Button
            type="button"
            onClick={handleAccept}
            disabled={!isChecked || isPending}
          >
            {isPending ? "שומר..." : "אישור והמשך"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
