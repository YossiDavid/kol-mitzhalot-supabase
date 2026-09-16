"use client";

import { Trash2 } from "lucide-react";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { INSTITUTION_TYPE_LABELS } from "@/features/institutions/lib/institution-labels";
import type {
  InstitutionOption,
  StaffFormData,
} from "@/features/settings/lib/staff-application-schema";

/** שורות השיוך: מוסד לימודים + תפקיד, עם אפשרות להסיר שורה */
export function StaffInstitutionRows({
  form,
  institutionFields,
  availableInstitutions,
  isLoading,
  isInstitutionsLoading,
}: {
  form: UseFormReturn<StaffFormData>;
  institutionFields: UseFieldArrayReturn<StaffFormData, "institutions">;
  availableInstitutions: (index: number) => InstitutionOption[];
  isLoading: boolean;
  isInstitutionsLoading: boolean;
}) {
  return (
    <>
      {institutionFields.fields.map((entry, index) => (
        <div
          key={entry.id}
          className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-end"
        >
          <FormField
            control={form.control}
            name={`institutions.${index}.institutionId`}
            render={({ field }) => (
              <FormFieldShell label="מוסד לימודים" required className="flex-1">
                <NativeSelect
                  {...field}
                  disabled={isLoading || isInstitutionsLoading}
                >
                  <NativeSelectOption value="" disabled>
                    {isInstitutionsLoading
                      ? "טוען מוסדות..."
                      : "בחר/י מוסד לימודים"}
                  </NativeSelectOption>
                  {availableInstitutions(index).map((institution) => (
                    <NativeSelectOption
                      key={institution.id}
                      value={institution.id}
                    >
                      {`${institution.name}${institution.city ? ` · ${institution.city}` : ""} · ${INSTITUTION_TYPE_LABELS[institution.type]}`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormFieldShell>
            )}
          />

          <FormField
            control={form.control}
            name={`institutions.${index}.position`}
            render={({ field }) => (
              <FormFieldShell label="תפקיד" required className="flex-1">
                <Input
                  {...field}
                  placeholder="לדוגמה: משגיח, מחנכת"
                  disabled={isLoading}
                />
              </FormFieldShell>
            )}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 self-end text-muted-foreground"
            aria-label="הסרת המוסד"
            // המוסד האחרון לא נמחק: בלעדיו אין בקשה
            disabled={isLoading || institutionFields.fields.length === 1}
            onClick={() => institutionFields.remove(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </>
  );
}
