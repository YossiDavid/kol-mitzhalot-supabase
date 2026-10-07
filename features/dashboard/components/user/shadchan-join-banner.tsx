"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Clock, HeartHandshake, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ShadchanJoinPrompt } from "@/features/dashboard/lib/shadchan-join-prompt";

const DISMISS_STORAGE_KEY = "shadchan-join-banner-dismissed";
const SHADCHAN_SETTINGS_HREF = "/app/settings/shadchan";

/** הסגירה נשמרת לסשן הדפדפן בלבד; sessionStorage עלול להיות חסום */
function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** מצב הסגירה בזיכרון - גם כשהאחסון חסום, הבאנר נסגר עד הרענון */
let isDismissedInMemory = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getIsDismissed(): boolean {
  return isDismissedInMemory || readDismissed();
}

function dismiss() {
  isDismissedInMemory = true;
  try {
    window.sessionStorage.setItem(DISMISS_STORAGE_KEY, "1");
  } catch {
    // בלי אחסון - הבאנר רק לא יישאר סגור אחרי רענון
  }
  listeners.forEach((listener) => listener());
}

/**
 * באנר בראש הדשבורד למי שנרשם כדי להצטרף כשדכן: ההרשמה לבדה אינה בקשת
 * הצטרפות. complete - כפתור לטופס; pending - הבקשה ממתינה לאישור.
 */
export function ShadchanJoinBanner({
  prompt,
}: {
  prompt: Exclude<ShadchanJoinPrompt, "none">;
}) {
  // בשרת הבאנר מוצג; בדפדפן נקרא מצב הסגירה של הסשן
  const isDismissed = useSyncExternalStore(
    subscribe,
    getIsDismissed,
    () => false,
  );

  if (isDismissed) return null;

  const isPending = prompt === "pending";
  const Icon = isPending ? Clock : HeartHandshake;

  return (
    <section
      aria-label="הצטרפות כשדכן"
      data-testid="shadchan-join-banner"
      data-prompt={prompt}
      className="relative flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 pe-12 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p className="font-bold">
            {isPending
              ? "הבקשה ממתינה לאישור"
              : "עוד צעד אחד כדי להצטרף כשדכן/ית"}
          </p>
          <p className="text-body-sm text-muted-foreground">
            {isPending
              ? "קיבלנו את בקשת ההצטרפות שלך. מנהל המערכת יאשר אותה בקרוב."
              : "ההרשמה למערכת אינה בקשת הצטרפות כשדכן. יש למלא את טופס ההצטרפות בהגדרות, והבקשה תיבדק ותאושר על ידי מנהל."}
          </p>
        </div>
      </div>
      {!isPending && (
        <Button asChild className="shrink-0">
          <Link href={SHADCHAN_SETTINGS_HREF}>להשלמת בקשת ההצטרפות כשדכן</Link>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute end-2 top-2"
        aria-label="סגירת ההודעה"
        onClick={dismiss}
      >
        <X />
      </Button>
    </section>
  );
}
