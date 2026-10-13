"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { saveDedication } from "@/app/app/admin/content/dedications/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormActions, FormFields, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { DedicationPreview } from "@/features/dedications/components/dedication-preview";
import { findOverlaps } from "@/features/dedications/components/dedication-overlap";
import { defaultDatesForKind } from "@/features/dedications/lib/dedication-defaults";
import {
  DEDICATION_KINDS,
  DEDICATION_TYPE_VALUES,
  DONOR_LINE_MAX_LENGTH,
  HONOREE_MAX_LENGTH,
  KIND_LABELS,
  NOTE_MAX_LENGTH,
  type AdminDedication,
  type DedicationKind,
} from "@/features/dedications/lib/dedication-model";
import { DedicationPeriodText } from "@/features/dedications/components/dedication-period-text";
import {
  dedicationFormSchema,
  type DedicationFormValues,
} from "@/features/dedications/lib/dedication-schema";
import { israelDateOf } from "@/features/dedications/lib/israel-date";

const DEFAULT_KIND: DedicationKind = "sponsor_day";
const DEFAULT_SORT_ORDER = "0";

function newFormValues(): DedicationFormValues {
  const today = israelDateOf(new Date());
  return {
    kind: DEFAULT_KIND,
    dedication_type: "",
    honoree: "",
    donor_line: "",
    note: "",
    ...defaultDatesForKind(DEFAULT_KIND, today),
    sort_order: DEFAULT_SORT_ORDER,
    is_published: true,
  };
}

function toFormValues(editing: AdminDedication | null): DedicationFormValues {
  if (!editing) return newFormValues();
  return {
    kind: editing.kind,
    dedication_type: editing.dedication_type ?? "",
    honoree: editing.honoree,
    donor_line: editing.donor_line ?? "",
    note: editing.note ?? "",
    starts_on: editing.starts_on,
    ends_on: editing.ends_on ?? "",
    sort_order: String(editing.sort_order),
    is_published: editing.is_published,
  };
}

interface DedicationFormProps {
  editing: AdminDedication | null;
  /** כל ההקדשות הנוכחיות, לאזהרת חפיפה */
  existing: readonly AdminDedication[];
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * טופס הקדשה (ניהול) עם תצוגה מקדימה חיה. בחירת סוג ממלאת תאריכי ברירת
 * מחדל (בהוספה בלבד, ורק אם המנהל לא שינה אותם בעצמו); הוא חופשי לשנות.
 * הקורא מרנדר עם `key` לפי הפריט הנערך כדי לאפס את הערכים.
 */
export function DedicationForm({
  editing,
  existing,
  onSaved,
  onCancel,
}: DedicationFormProps) {
  const form = useForm<DedicationFormValues>({
    resolver: zodResolver(dedicationFormSchema),
    defaultValues: toFormValues(editing),
  });
  const { isSubmitting, dirtyFields } = form.formState;

  // watch(): התצוגה המקדימה והאזהרה חיות ומחושבות מכל הערכים בכל הקשה
  // eslint-disable-next-line react-hooks/incompatible-library
  const values = form.watch();
  const overlaps = findOverlaps(values, existing, editing?.id ?? null);

  function applyDefaultDates(kind: DedicationKind) {
    if (editing) return;
    const wasEditedByHand = dirtyFields.starts_on || dirtyFields.ends_on;
    if (wasEditedByHand) return;
    const dates = defaultDatesForKind(kind, israelDateOf(new Date()));
    form.setValue("starts_on", dates.starts_on, { shouldValidate: true });
    form.setValue("ends_on", dates.ends_on, { shouldValidate: true });
  }

  async function handleSave(parsed: DedicationFormValues) {
    const result = await saveDedication({ id: editing?.id, values: parsed });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(editing ? "ההקדשה עודכנה" : "ההקדשה נוספה");
    onSaved();
  }

  return (
    <Card className="w-full max-w-5xl">
      <CardContent>
        <Form {...form}>
          {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
          <form onSubmit={form.handleSubmit(handleSave)} noValidate>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(0,24rem)]">
              <FormFields>
                <FormGrid>
                  <FormField
                    control={form.control}
                    name="kind"
                    render={({ field }) => (
                      <FormFieldShell label="סוג" required>
                        <NativeSelect
                          {...field}
                          disabled={isSubmitting}
                          onChange={(event) => {
                            field.onChange(event);
                            applyDefaultDates(
                              event.target.value as DedicationKind,
                            );
                          }}
                        >
                          {DEDICATION_KINDS.map((kind) => (
                            <NativeSelectOption key={kind} value={kind}>
                              {KIND_LABELS[kind]}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </FormFieldShell>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dedication_type"
                    render={({ field }) => (
                      <FormFieldShell label="סוג ההקדשה">
                        <NativeSelect {...field} disabled={isSubmitting}>
                          <NativeSelectOption value="">ללא</NativeSelectOption>
                          {DEDICATION_TYPE_VALUES.map((type) => (
                            <NativeSelectOption key={type} value={type}>
                              {type}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </FormFieldShell>
                    )}
                  />
                </FormGrid>

                <FormField
                  control={form.control}
                  name="honoree"
                  render={({ field }) => (
                    <FormFieldShell
                      label="שם המוקדש"
                      required
                      description="השם או השמות שההקדשה מוקדשת להם, למשל: משה בן שרה"
                    >
                      <Input
                        {...field}
                        maxLength={HONOREE_MAX_LENGTH * 2}
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormField
                  control={form.control}
                  name="donor_line"
                  render={({ field }) => (
                    <FormFieldShell
                      label="שורת התורם"
                      description={`למשל: נתרם על ידי משפחת כהן. עד ${DONOR_LINE_MAX_LENGTH} תווים`}
                    >
                      <Input {...field} disabled={isSubmitting} />
                    </FormFieldShell>
                  )}
                />

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormFieldShell
                      label="הערה קצרה"
                      description={`טקסט חופשי, עד ${NOTE_MAX_LENGTH} תווים. טקסט פשוט בלבד, בלי קישורים`}
                    >
                      <Textarea {...field} rows={3} disabled={isSubmitting} />
                    </FormFieldShell>
                  )}
                />

                <FormGrid>
                  <FormField
                    control={form.control}
                    name="starts_on"
                    render={({ field }) => (
                      <FormFieldShell label="מתאריך" required>
                        <Input {...field} type="date" disabled={isSubmitting} />
                      </FormFieldShell>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ends_on"
                    render={({ field }) => (
                      <FormFieldShell
                        label="עד תאריך (כולל)"
                        description={
                          values.kind === "memorial"
                            ? "ריק = מוצגת עד שמסירים אותה"
                            : undefined
                        }
                      >
                        <Input {...field} type="date" disabled={isSubmitting} />
                      </FormFieldShell>
                    )}
                  />
                </FormGrid>
                {values.starts_on && values.ends_on ? (
                  <p className="text-caption text-muted-foreground">
                    התקופה:{" "}
                    <DedicationPeriodText
                      startsOn={values.starts_on}
                      endsOn={values.ends_on}
                    />
                  </p>
                ) : null}

                {overlaps.length > 0 ? (
                  <div
                    role="status"
                    data-testid="dedication-overlap-warning"
                    className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-muted p-3 text-body-sm text-warning-muted-foreground"
                  >
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <p>
                      קיימת הקדשה מפורסמת נוספת מאותו סוג בתקופה חופפת (
                      {overlaps.map((item) => item.honoree).join(", ")}). אפשר
                      לשמור: כולן יוצגו באתר לפי סדר התצוגה.
                    </p>
                  </div>
                ) : null}

                <FormGrid>
                  <FormField
                    control={form.control}
                    name="sort_order"
                    render={({ field }) => (
                      <FormFieldShell
                        label="סדר תצוגה"
                        description="מספר נמוך מוצג קודם, כשיש כמה הקדשות מאותו סוג"
                      >
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />
                </FormGrid>

                <FormField
                  control={form.control}
                  name="is_published"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">
                        מפורסמת באתר
                      </FormLabel>
                    </FormItem>
                  )}
                />

                <FormActions>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                  >
                    ביטול
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "שומר..." : editing ? "עדכן" : "הוסף"}
                  </Button>
                </FormActions>
              </FormFields>

              <div className="lg:sticky lg:top-4 lg:self-start">
                <DedicationPreview values={values} />
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
