"use client";

import type { Control } from "react-hook-form";

import { FormControl, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { SHADCHAN_MATCH_TYPE_OPTIONS } from "@/features/shadchanim/lib/match-types";
import type { ShadchanFormData } from "@/features/shadchanim/lib/profile-form";

const FIELD_LABEL = "סוג שידוכים שאני עוסק/ת בהם";

/** הוספה או הסרה של ערך, בלי לשנות את המערך הקיים */
function toggleValue(
  current: readonly string[],
  value: string,
  isChecked: boolean,
): string[] {
  const without = current.filter((item) => item !== value);
  return isChecked ? [...without, value] : without;
}

/** "סוג שידוכים שעוסק": בחירה מרובה (חובה לפחות אחד) */
export function ShadchanMatchTypesField({
  control,
  isSubmitting,
}: {
  control: Control<ShadchanFormData>;
  isSubmitting: boolean;
}) {
  return (
    <FormField
      control={control}
      name="match_types"
      render={({ field }) => (
        <FormFieldShell
          label={FIELD_LABEL}
          description="אפשר לבחור כמה. גלוי להנהלת האתר."
          required
          isComposite
        >
          <FormControl>
            <div
              role="group"
              aria-label={FIELD_LABEL}
              className="flex min-h-10 flex-wrap items-center gap-x-6 gap-y-2"
            >
              {SHADCHAN_MATCH_TYPE_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="checkbox"
                    name={field.name}
                    value={value}
                    checked={field.value.includes(value)}
                    onChange={(event) =>
                      field.onChange(
                        toggleValue(field.value, value, event.target.checked),
                      )
                    }
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    className="size-4 accent-primary"
                  />
                  {label}
                </label>
              ))}
            </div>
          </FormControl>
        </FormFieldShell>
      )}
    />
  );
}
