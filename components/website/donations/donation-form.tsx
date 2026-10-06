"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  AMOUNT_PRESETS,
  DEDICATION_TYPES,
  FREQUENCY_OPTIONS,
  NO_DEDICATION,
  composeDedication,
  resolveAmount,
  validateDonationFormClient,
  type DonationFormErrors,
  type DonationFormField,
  type DonationFormValues,
} from "@/features/donations/lib/donation-form";
import {
  DEDICATION_NAME_MAX_LENGTH,
  DONOR_ID_MAX_DIGITS,
  isDonorIdRequired,
  DONOR_NAME_MAX_LENGTH,
  type DonationFrequency,
} from "@/features/donations/lib/nedarim";
import { createDonationIntent } from "@/features/donations/lib/intent-client";
import {
  buildStartPaymentValue,
  type StartPaymentValue,
} from "@/features/donations/lib/start-payment";
import type { ProviderFieldError } from "@/features/donations/lib/provider-errors";
import { ChoiceCard } from "./choice-card";
import { FormField, fieldDescriptionId } from "./form-field";

interface DonationFormProps {
  /** הגדרות נדרים פלוס תקינות (מאומתות בשרת; ציבוריות) */
  mosadId: string;
  apiValid: string;
  /** נקרא אחרי וולידציה ויצירת כוונה בשרת: ה-Value ל-StartPayment וה-id של הכוונה */
  onContinue: (value: StartPaymentValue, intentId: string) => void;
  /** סירוב מהספק שממופה לשדה: מציג את ההודעה ומעביר אליו מיקוד. אובייקט חדש בכל סירוב */
  providerError?: ProviderFieldError | null;
}

const INITIAL_VALUES: DonationFormValues = {
  presetAmount: 180,
  customAmount: "",
  dedicationType: NO_DEDICATION,
  dedicationName: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  donorId: "",
};

/** חברת הסליקה דורשת טלפון ומייל לחיוב אשראי מכתובת IP מחוץ לישראל */
const ABROAD_HINT = "לתורמים מחו״ל: חברת הסליקה דורשת טלפון ומייל";

/** אורך שדה הזהות: מקום לרווחים/מקפים; הבדיקה האמיתית אחרי הסרתם */
const DONOR_ID_INPUT_MAX_LENGTH = DONOR_ID_MAX_DIGITS + 6;

const FIELD_IDS: Record<DonationFormField, string> = {
  amount: "donation-custom-amount",
  dedicationName: "donation-dedication-name",
  phone: "donation-phone",
  email: "donation-email",
  donorId: "donation-donor-id",
};

const FIELD_ORDER: DonationFormField[] = [
  "amount",
  "dedicationName",
  "donorId",
  "phone",
  "email",
];

const formatShekels = (amount: number) => `${amount.toLocaleString("he-IL")} ₪`;

/** אינדיקציה נגישה לשדה עם שגיאה */
const fieldA11y = (field: DonationFormField, errors: DonationFormErrors) => ({
  "aria-invalid": errors[field] ? true : undefined,
  "aria-describedby": errors[field]
    ? fieldDescriptionId(FIELD_IDS[field])
    : undefined,
});

export function DonationForm({
  mosadId,
  apiValid,
  onContinue,
  providerError = null,
}: DonationFormProps) {
  const [values, setValues] = useState<DonationFormValues>(INITIAL_VALUES);
  const [frequency, setFrequency] = useState<DonationFrequency>("once");
  const [errors, setErrors] = useState<DonationFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // נעילה סינכרונית נגד לחיצה כפולה לפני שה-state מתעדכן
  const isSubmittingRef = useRef(false);

  const update = (patch: Partial<DonationFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  // סירוב מהספק (למשל NEED ZEOUT): ההודעה ליד השדה והמיקוד אליו. הטופס כבר גלוי ברינדור הזה
  useEffect(() => {
    if (!providerError) return;
    setErrors((current) => ({
      ...current,
      [providerError.field]: providerError.message,
    }));
    document.getElementById(FIELD_IDS[providerError.field])?.focus();
  }, [providerError]);

  const isIdRequired = isDonorIdRequired(frequency);
  const hasDedication = values.dedicationType !== NO_DEDICATION;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmittingRef.current) return;
    const nextErrors = validateDonationFormClient(values, frequency);
    setErrors(nextErrors);
    setSubmitError(null);

    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const amount = resolveAmount(values);
    const dedication = composeDedication(
      values.dedicationType,
      values.dedicationName,
    );
    // כוונה חדשה בכל המשך: StartPayment חוזר דורס את הקודם, וכל תשלום נקשר ל-id משלו
    // מספר הזהות אינו נשלח לשרת שלנו: רק ל-iframe של הספק (ראו buildStartPaymentValue)
    const result = await createDonationIntent({
      amount,
      frequency,
      dedicationType: values.dedicationType,
      dedicationName: values.dedicationName,
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email,
    });
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }

    const value = buildStartPaymentValue({
      mosadId,
      apiValid,
      amount,
      frequency,
      dedication,
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone,
      email: values.email,
      donorId: values.donorId,
      createId: () => result.intent.id,
      callBack: result.intent.callbackUrl,
    });
    if (value) onContinue(value, result.intent.id);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-subtitle font-bold text-foreground">
          סכום התרומה
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {AMOUNT_PRESETS.map((preset) => (
            <ChoiceCard
              key={preset}
              name="donation-preset"
              value={String(preset)}
              checked={
                !values.customAmount.trim() && values.presetAmount === preset
              }
              onSelect={() =>
                update({ presetAmount: preset, customAmount: "" })
              }
              className="text-body font-bold"
            >
              {formatShekels(preset)}
            </ChoiceCard>
          ))}
        </div>
        <FormField
          id={FIELD_IDS.amount}
          label="סכום אחר (בש״ח)"
          error={errors.amount}
          optional
        >
          <Input
            id={FIELD_IDS.amount}
            inputMode="numeric"
            autoComplete="off"
            placeholder="למשל 500"
            value={values.customAmount}
            onChange={(event) =>
              update({
                customAmount: event.target.value,
                presetAmount: null,
              })
            }
            {...fieldA11y("amount", errors)}
          />
        </FormField>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-subtitle font-bold text-foreground">
          תדירות
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FREQUENCY_OPTIONS.map(({ value, label, hint }) => (
            <ChoiceCard
              key={value}
              name="donation-frequency"
              value={value}
              checked={frequency === value}
              onSelect={() => setFrequency(value)}
            >
              <span className="flex flex-col gap-1">
                <span className="text-body font-bold">{label}</span>
                <span className="text-caption font-normal text-muted-foreground">
                  {hint}
                </span>
              </span>
            </ChoiceCard>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-subtitle font-bold text-foreground">
          הקדשה{" "}
          <span className="text-body-sm font-normal text-muted-foreground">
            (לא חובה)
          </span>
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.5fr]">
          <FormField id="donation-dedication-type" label="סוג ההקדשה">
            <NativeSelect
              id="donation-dedication-type"
              value={values.dedicationType}
              onChange={(event) => {
                update({ dedicationType: event.target.value });
                setErrors((current) => ({
                  ...current,
                  dedicationName: undefined,
                }));
              }}
            >
              {DEDICATION_TYPES.map(({ value, label }) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          {hasDedication && (
            <FormField
              id={FIELD_IDS.dedicationName}
              label="שם"
              error={errors.dedicationName}
              hint="למשל: משה בן שרה"
            >
              <Input
                id={FIELD_IDS.dedicationName}
                maxLength={DEDICATION_NAME_MAX_LENGTH}
                value={values.dedicationName}
                onChange={(event) =>
                  update({ dedicationName: event.target.value })
                }
                {...fieldA11y("dedicationName", errors)}
              />
            </FormField>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-subtitle font-bold text-foreground">
          פרטי התורם{" "}
          <span className="text-body-sm font-normal text-muted-foreground">
            {isIdRequired ? "(תעודת זהות נדרשת, השאר לא חובה)" : "(לא חובה)"}
          </span>
        </legend>
        <p className="text-body-sm text-muted-foreground">
          פרטים שתמלאו כאן יועברו למסך התשלום כך שלא תצטרכו להקלידם שוב. את שאר
          הפרטים אפשר להשאיר ריקים ולמלא שם.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="donation-first-name" label="שם פרטי">
            <Input
              id="donation-first-name"
              autoComplete="given-name"
              maxLength={DONOR_NAME_MAX_LENGTH}
              value={values.firstName}
              onChange={(event) => update({ firstName: event.target.value })}
            />
          </FormField>
          <FormField id="donation-last-name" label="שם משפחה">
            <Input
              id="donation-last-name"
              autoComplete="family-name"
              maxLength={DONOR_NAME_MAX_LENGTH}
              value={values.lastName}
              onChange={(event) => update({ lastName: event.target.value })}
            />
          </FormField>
          <FormField
            id={FIELD_IDS.donorId}
            label="תעודת זהות"
            error={errors.donorId}
            hint={
              isIdRequired
                ? "הוראת קבע באשראי דורשת מספר תעודת זהות"
                : "לבעלי כרטיס אשראי ישראלי. חברת הסליקה עשויה לדרוש זאת להשלמת התרומה."
            }
            optional={!isIdRequired}
          >
            <Input
              id={FIELD_IDS.donorId}
              inputMode="numeric"
              dir="ltr"
              className="text-end"
              autoComplete="off"
              maxLength={DONOR_ID_INPUT_MAX_LENGTH}
              value={values.donorId}
              onChange={(event) => update({ donorId: event.target.value })}
              {...fieldA11y("donorId", errors)}
            />
          </FormField>
          <FormField
            id={FIELD_IDS.phone}
            label="טלפון"
            error={errors.phone}
            hint={ABROAD_HINT}
          >
            <Input
              id={FIELD_IDS.phone}
              type="tel"
              dir="ltr"
              className="text-end"
              autoComplete="tel"
              value={values.phone}
              onChange={(event) => update({ phone: event.target.value })}
              {...fieldA11y("phone", errors)}
            />
          </FormField>
          <FormField
            id={FIELD_IDS.email}
            label="מייל"
            error={errors.email}
            hint={ABROAD_HINT}
          >
            <Input
              id={FIELD_IDS.email}
              type="email"
              dir="ltr"
              className="text-end"
              autoComplete="email"
              value={values.email}
              onChange={(event) => update({ email: event.target.value })}
              {...fieldA11y("email", errors)}
            />
          </FormField>
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold-soft active:bg-brand-gold-muted sm:self-start"
        >
          <HeartHandshake aria-hidden="true" />
          המשך לתשלום מאובטח
        </Button>
        {submitError && (
          <p
            role="alert"
            data-testid="donation-submit-error"
            className="text-body-sm text-destructive"
          >
            {submitError}
          </p>
        )}
        <p className="text-caption text-muted-foreground">
          התשלום מתבצע במסך מאובטח של נדרים פלוס. קבלה מופקת על ידי הספק לאחר
          התרומה.
        </p>
      </div>
    </form>
  );
}
