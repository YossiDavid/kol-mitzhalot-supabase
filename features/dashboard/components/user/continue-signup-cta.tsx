"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { HeartHandshake, UserPlus, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ContinueSignupTarget } from "@/features/dashboard/lib/continue-signup";

import { ShadchanJoinBanner } from "./shadchan-join-banner";

type TargetCopy = {
  href: Route;
  icon: LucideIcon;
  title: string;
  body: string;
  cta: string;
};

const COPY: Record<ContinueSignupTarget, TargetCopy> = {
  shadchan: {
    href: "/app/settings/shadchan" as Route,
    icon: HeartHandshake,
    title: "המשך הרשמה כשדכן/ית",
    body: "ההרשמה למערכת עוד לא הושלמה. כדי להצטרף כשדכן/ית יש למלא את טופס ההצטרפות - הבקשה תיבדק ותאושר על ידי מנהל המערכת.",
    cta: "המשך הרשמה",
  },
  staff: {
    href: "/app/settings/staff" as Route,
    icon: HeartHandshake,
    title: "המשך הרשמה כאיש/ת צוות",
    body: "ההרשמה למערכת עוד לא הושלמה. כדי להצטרף כאיש/ת צוות יש למלא את טופס ההצטרפות - הבקשה תיבדק ותאושר על ידי מנהל המערכת.",
    cta: "המשך הרשמה",
  },
  card: {
    href: "/app/students/create" as Route,
    icon: UserPlus,
    title: "המשך הרשמה - הוספת כרטיס",
    body: "כדי שהשדכנים יוכלו להציע שידוכים, הוסיפו את הכרטיס הראשון: שלכם, או של הבן/הבת.",
    cta: "הוספת כרטיס",
  },
};

/** הגרסה המוקטנת אחרי "אחר כך": באנר קומפקטי עם אותו יעד */
function MinimizedCard({ copy }: { copy: TargetCopy }) {
  const Icon = copy.icon;
  return (
    <section
      aria-label={copy.title}
      data-testid="continue-signup-banner"
      className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-center gap-3 font-bold">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden />
        {copy.title}
      </p>
      <Button asChild className="shrink-0">
        <Link href={copy.href}>{copy.cta}</Link>
      </Button>
    </section>
  );
}

/**
 * כרטיס "המשך הרשמה" גדול במרכז הדשבורד, עד שהבקשה הוגשה / שנוסף כרטיס.
 * "אחר כך" רק מקטין אותו לבאנר עד הכניסה הבאה לדשבורד - הוא לא נעלם.
 */
export function ContinueSignupCta({
  target,
}: {
  target: ContinueSignupTarget;
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const copy = COPY[target];
  const Icon = copy.icon;

  if (isMinimized) {
    return target === "card" ? (
      <MinimizedCard copy={copy} />
    ) : (
      <ShadchanJoinBanner prompt="complete" track={target} />
    );
  }

  return (
    <section
      aria-labelledby="continue-signup-title"
      data-testid="continue-signup-cta"
      data-target={target}
      className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 rounded-2xl border-2 border-primary/50 bg-primary/5 px-6 py-10 text-center shadow-sm"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-primary/15">
        <Icon className="size-8 text-primary" aria-hidden />
      </span>
      <div className="space-y-2">
        <h2 id="continue-signup-title" className="text-title font-black">
          {copy.title}
        </h2>
        <p className="text-body text-muted-foreground">{copy.body}</p>
      </div>
      <Button asChild size="lg" className="w-full max-w-sm text-subtitle">
        <Link href={copy.href}>{copy.cta}</Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsMinimized(true)}
      >
        אחר כך
      </Button>
    </section>
  );
}
