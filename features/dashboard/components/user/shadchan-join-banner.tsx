"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Clock, HeartHandshake, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  JoinTrack,
  ShadchanJoinPrompt,
} from "@/features/dashboard/lib/shadchan-join-prompt";

/** טקסטים, יעד ומפתחות לכל מסלול הצטרפות */
const TRACK_COPY = {
  shadchan: {
    storageKey: "shadchan-join-banner-dismissed",
    href: "/app/settings/shadchan",
    testId: "shadchan-join-banner",
    ariaLabel: "הצטרפות כשדכן",
    title: "עוד צעד אחד כדי להצטרף כשדכן/ית",
    body: "ההרשמה למערכת אינה בקשת הצטרפות כשדכן. יש למלא את טופס ההצטרפות בהגדרות, והבקשה תיבדק ותאושר על ידי מנהל.",
    cta: "להשלמת בקשת ההצטרפות כשדכן",
  },
  staff: {
    storageKey: "staff-join-banner-dismissed",
    href: "/app/settings/staff",
    testId: "staff-join-banner",
    ariaLabel: "הצטרפות כאיש צוות",
    title: "עוד צעד אחד כדי להצטרף כאיש/ת צוות",
    body: "ההרשמה למערכת אינה בקשת הצטרפות כאיש צוות. יש למלא את טופס ההצטרפות בהגדרות, והבקשה תיבדק ותאושר על ידי מנהל.",
    cta: "להשלמת בקשת ההצטרפות כאיש צוות",
  },
} as const satisfies Record<JoinTrack, Record<string, string>>;

const PENDING_TITLE = "הבקשה ממתינה לאישור";
const PENDING_BODY =
  "קיבלנו את בקשת ההצטרפות שלך. מנהל המערכת יאשר אותה בקרוב.";

/** הסגירה נשמרת לסשן הדפדפן בלבד; sessionStorage עלול להיות חסום */
function readDismissed(track: JoinTrack): boolean {
  try {
    return window.sessionStorage.getItem(TRACK_COPY[track].storageKey) === "1";
  } catch {
    return false;
  }
}

/** מצב הסגירה בזיכרון - גם כשהאחסון חסום, הבאנר נסגר עד הרענון */
const dismissedInMemory = new Set<JoinTrack>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getIsDismissed(track: JoinTrack): boolean {
  return dismissedInMemory.has(track) || readDismissed(track);
}

function dismiss(track: JoinTrack) {
  dismissedInMemory.add(track);
  try {
    window.sessionStorage.setItem(TRACK_COPY[track].storageKey, "1");
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
  track = "shadchan",
}: {
  prompt: Exclude<ShadchanJoinPrompt, "none">;
  track?: JoinTrack;
}) {
  const copy = TRACK_COPY[track];
  // בשרת הבאנר מוצג; בדפדפן נקרא מצב הסגירה של הסשן
  const isDismissed = useSyncExternalStore(
    subscribe,
    () => getIsDismissed(track),
    () => false,
  );

  if (isDismissed) return null;

  const isPending = prompt === "pending";
  const Icon = isPending ? Clock : HeartHandshake;

  return (
    <section
      aria-label={copy.ariaLabel}
      data-testid={copy.testId}
      data-prompt={prompt}
      className="relative flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 pe-12 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-1">
          <p className="font-bold">{isPending ? PENDING_TITLE : copy.title}</p>
          <p className="text-body-sm text-muted-foreground">
            {isPending ? PENDING_BODY : copy.body}
          </p>
        </div>
      </div>
      {!isPending && (
        <Button asChild className="shrink-0">
          <Link href={copy.href}>{copy.cta}</Link>
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute end-2 top-2"
        aria-label="סגירת ההודעה"
        onClick={() => dismiss(track)}
      >
        <X />
      </Button>
    </section>
  );
}
