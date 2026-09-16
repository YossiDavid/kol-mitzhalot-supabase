"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormFields, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  INSTITUTION_GENDER_OPTIONS,
  INSTITUTION_TYPE_OPTIONS,
} from "@/features/institutions/lib/institution-labels";
import type { InstitutionFormState } from "@/features/institutions/lib/institution-form-schema";

/** דיאלוג יצירה ועריכה של מוסד לימודים (ניהול) */
export function InstitutionFormDialog({
  open,
  onOpenChange,
  form,
  editingId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<InstitutionFormState>;
  editingId: string | null;
  onSubmit: (values: InstitutionFormState) => Promise<void>;
}) {
  const { isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? "עריכת מוסד" : "מוסד חדש"}</DialogTitle>
          <DialogDescription>
            מוסדות אלה מוצעים לבחירה באשף יצירת כרטיס מיועד.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FormFields>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormFieldShell label="שם המוסד" required>
                    <Input
                      {...field}
                      placeholder="לדוגמה: ישיבת אור החיים"
                      disabled={isSubmitting}
                    />
                  </FormFieldShell>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormFieldShell label="עיר">
                    <Input
                      {...field}
                      placeholder="לדוגמה: בני ברק"
                      disabled={isSubmitting}
                    />
                  </FormFieldShell>
                )}
              />

              <FormGrid>
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormFieldShell label="מגדר" required>
                      <NativeSelect {...field} disabled={isSubmitting}>
                        {INSTITUTION_GENDER_OPTIONS.map((option) => (
                          <NativeSelectOption
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
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
                      <NativeSelect {...field} disabled={isSubmitting}>
                        {INSTITUTION_TYPE_OPTIONS.map((option) => (
                          <NativeSelectOption
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </FormFieldShell>
                  )}
                />
              </FormGrid>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <Label htmlFor="institutionActive">מוסד פעיל</Label>
                      <p className="text-body-sm text-muted-foreground">
                        מוסד לא פעיל לא יוצג לבחירה באשף יצירת כרטיס מיועד
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        id="institutionActive"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                  </div>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  ביטול
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "שומר..." : "שמירה"}
                </Button>
              </DialogFooter>
            </FormFields>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
