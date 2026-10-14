"use client";

import { ChevronDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useWatch, type Control } from "react-hook-form";

import ShadchanCard from "@/features/shadchanim/components/shadchan-card";
import {
  formToPreviewCard,
  type PreviewIdentity,
} from "@/features/shadchanim/lib/preview-card";
import type { ShadchanFormData } from "@/features/shadchanim/lib/profile-form";
import { cn } from "@/lib/utils";

interface ShadchanCardPreviewProps {
  control: Control<ShadchanFormData>;
  identity: PreviewIdentity;
}

/**
 * תצוגה מקדימה חיה של הכרטיס ברשימת השדכנים, לצד הטופס. אותו ShadchanCard
 * ואותו מיפוי כמו ברשימה; הפעולות כבויות. בדסקטופ תמיד מוצגת; במובייל
 * נפתחת ונסגרת מכותרת.
 */
export function ShadchanCardPreview({
  control,
  identity,
}: ShadchanCardPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const values = useWatch({ control });
  const card = useMemo(
    () => formToPreviewCard(values, identity),
    [values, identity],
  );

  return (
    <section data-testid="shadchan-card-preview" className="grid gap-3">
      <h3 className="hidden text-subtitle font-semibold lg:block">
        תצוגה מקדימה
      </h3>
      <button
        type="button"
        className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-start font-semibold lg:hidden"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        תצוגה מקדימה
        <ChevronDown
          className={cn("size-4 transition-transform", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        className={cn("grid gap-2", !isOpen && "hidden lg:grid")}
      >
        <p className="text-body-sm text-muted-foreground">
          כך ייראה הכרטיס שלך ברשימת השדכנים.
        </p>
        <ShadchanCard shadchan={card} quota={null} isPreview />
      </div>
    </section>
  );
}
