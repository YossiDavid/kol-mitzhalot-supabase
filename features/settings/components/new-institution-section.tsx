"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import {
  FormActions,
  FormFields,
  FormGrid,
  FormSubmitError,
} from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { INSTITUTION_GENDER_OPTIONS } from "@/features/institutions/lib/institution-labels";
import {
  EMPTY_NEW_INSTITUTION,
  STAFF_INSTITUTION_TYPE_OPTIONS,
  newInstitutionSchema,
  type NewInstitutionValues,
} from "@/features/settings/lib/staff-application-schema";
import { createClient } from "@/lib/supabase/client";

/**
 * הוספת מוסד שלא קיים ברשימה. טופס נפרד משלו, כדי ששגיאות הוולידציה של
 * המוסד החדש לא ייחשבו כשגיאות של בקשת ההצטרפות עצמה.
 *
 * ה-RPC מחזיר מוסד קיים אם השם והעיר זהים, ולכן הבחירה ברשימה של העמוד
 * (`onCreated`) היא אחריות הקורא - הוא זה שיודע מה כבר נבחר.
 */
export function NewInstitutionSection({
  onCreated,
}: {
  onCreated: (institutionId: string, values: NewInstitutionValues) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);

  const form = useForm<NewInstitutionValues>({
    resolver: zodResolver(newInstitutionSchema),
    defaultValues: EMPTY_NEW_INSTITUTION,
  });
  const isSaving = form.formState.isSubmitting;

  const handleCreate = async (values: NewInstitutionValues) => {
    form.clearErrors("root");
    try {
      const supabase = createClient();
      const { data: newId, error } = await supabase.rpc("request_institution", {
        p_name: values.name,
        p_gender: values.gender,
        p_type: values.type,
        p_city: values.city || null,
      });
      if (error) throw error;

      onCreated(newId as string, values);

      form.reset(EMPTY_NEW_INSTITUTION);
      setIsAdding(false);
    } catch (err) {
      console.error("Error creating institution:", err);
      form.setError("root", { message: "שגיאה בהוספת המוסד" });
      toast.error("שגיאה בהוספת המוסד");
    }
  };

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className="text-body-sm text-primary underline underline-offset-4"
      >
        המוסד לא ברשימה? הוספת מוסד חדש
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <p className="text-body-sm font-medium">הוספת מוסד חדש</p>
      <Form {...form}>
        <FormFields>
          <FormGrid>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormFieldShell label="שם המוסד" required>
                  <Input {...field} disabled={isSaving} />
                </FormFieldShell>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormFieldShell label="עיר">
                  <Input {...field} disabled={isSaving} />
                </FormFieldShell>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormFieldShell label="מגדר" required>
                  <NativeSelect {...field} disabled={isSaving}>
                    {INSTITUTION_GENDER_OPTIONS.map((o) => (
                      <NativeSelectOption key={o.value} value={o.value}>
                        {o.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormFieldShell>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormFieldShell label="סוג מוסד" required>
                  <NativeSelect {...field} disabled={isSaving}>
                    {STAFF_INSTITUTION_TYPE_OPTIONS.map((o) => (
                      <NativeSelectOption key={o.value} value={o.value}>
                        {o.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </FormFieldShell>
              )}
            />
          </FormGrid>

          <FormSubmitError>
            {form.formState.errors.root?.message}
          </FormSubmitError>

          <FormActions>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => setIsAdding(false)}
            >
              ביטול
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={() => void form.handleSubmit(handleCreate)()}
            >
              {isSaving ? "שומר..." : "הוספה ובחירה"}
            </Button>
          </FormActions>
        </FormFields>
      </Form>
    </div>
  );
}
