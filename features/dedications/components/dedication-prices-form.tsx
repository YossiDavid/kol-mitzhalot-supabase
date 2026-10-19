"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { saveDedicationPrices } from "@/app/app/admin/content/dedications/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  KIND_LABELS,
  SPONSOR_KINDS_LARGEST_FIRST,
  type SponsorKind,
} from "@/features/dedications/lib/dedication-model";
import {
  dedicationPricesFormSchema,
  toPricesFormValues,
  type DedicationPrices,
  type DedicationPricesFormValues,
} from "@/features/dedications/lib/dedication-prices";

type PriceErrors = Partial<Record<SponsorKind, string>>;

interface DedicationPricesFormProps {
  prices: DedicationPrices;
  onSaved: () => void;
}

const fieldId = (kind: SponsorKind) => `dedication-price-${kind}`;

/** הודעות השגיאה מהסכמה, לפי שדה */
function errorsOf(values: DedicationPricesFormValues): PriceErrors {
  const parsed = dedicationPricesFormSchema.safeParse(values);
  if (parsed.success) return {};
  return Object.fromEntries(
    parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

/**
 * מחירי פרנס היום / השבוע / החודש (ניהול). מחיר שהוגדר: הקובייה הפנויה באתר
 * מפנה לדף תשלום בסכום הזה, וההקדשה מופיעה מיד אחרי אישור התשלום. ריק: הקובייה
 * מפנה לתרומה רגילה, כמו לפני שהוגדרו מחירים.
 */
export function DedicationPricesForm({
  prices,
  onSaved,
}: DedicationPricesFormProps) {
  const [values, setValues] = useState<DedicationPricesFormValues>(() =>
    toPricesFormValues(prices),
  );
  const [errors, setErrors] = useState<PriceErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = errorsOf(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setIsSaving(true);
    const result = await saveDedicationPrices(values);
    setIsSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("המחירים נשמרו");
    onSaved();
  }

  return (
    <Card className="w-full max-w-5xl" data-testid="dedication-prices">
      <CardContent>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          <div>
            <h2 className="text-subtitle font-bold text-primary">מחירי פרנס</h2>
            <p className="text-body-sm text-muted-foreground">
              כשמוגדר מחיר, לחיצה על קובייה פנויה באתר פותחת דף תשלום בסכום הזה,
              וההקדשה מופיעה באתר מיד אחרי אישור התשלום. השאירו ריק כדי שהקובייה
              תפנה לתרומה רגילה.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SPONSOR_KINDS_LARGEST_FIRST.map((kind) => (
              <div key={kind} className="flex flex-col gap-2">
                <Label htmlFor={fieldId(kind)}>{KIND_LABELS[kind]} (₪)</Label>
                <Input
                  id={fieldId(kind)}
                  inputMode="numeric"
                  dir="ltr"
                  className="text-end"
                  placeholder="ללא רכישה"
                  value={values[kind]}
                  aria-invalid={errors[kind] ? true : undefined}
                  aria-describedby={
                    errors[kind] ? `${fieldId(kind)}-error` : undefined
                  }
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [kind]: event.target.value,
                    }))
                  }
                />
                {errors[kind] ? (
                  <p
                    id={`${fieldId(kind)}-error`}
                    role="alert"
                    className="text-caption text-destructive"
                  >
                    {errors[kind]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "שומר..." : "שמירת מחירים"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
