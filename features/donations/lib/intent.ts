/**
 * כוונת תרומה בצד השרת: זהה לטופס. הצורה נבדקת עם zod, והכללים (טווח סכום,
 * קישור בהקדשה, טלפון ומייל) מגיעים מ-validateDonationForm עצמו, כך שהלקוח והשרת
 * לא יכולים להיסחף זה מזה. טהור, ללא Next/Supabase.
 */
import { z } from "zod";
import {
  DEDICATION_TYPES,
  NO_DEDICATION,
  composeDedication,
  validateDonationForm,
  type DonationFormErrors,
} from "./donation-form";
import {
  DEDICATION_NAME_MAX_LENGTH,
  DONOR_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
} from "./nedarim";

const PHONE_MAX_LENGTH = 30;
const DEDICATION_TYPE_VALUES = DEDICATION_TYPES.map(({ value }) => value) as [
  string,
  ...string[],
];

const text = (maxLength: number) => z.string().max(maxLength).default("");

/** מזהה או callback מהלקוח אינם חלק מהסכימה: שדות לא מוכרים נזרקים */
export const donationIntentSchema = z.object({
  amount: z.number(),
  frequency: z.enum(["once", "monthly"]),
  dedicationType: z.enum(DEDICATION_TYPE_VALUES).default(NO_DEDICATION),
  dedicationName: text(DEDICATION_NAME_MAX_LENGTH),
  firstName: text(DONOR_NAME_MAX_LENGTH),
  lastName: text(DONOR_NAME_MAX_LENGTH),
  phone: text(PHONE_MAX_LENGTH),
  email: text(EMAIL_MAX_LENGTH),
});

export type DonationIntentInput = z.infer<typeof donationIntentSchema>;

export type IntentValidation =
  | { ok: true; data: DonationIntentInput }
  | { ok: false; message: string; fields: DonationFormErrors };

const SHAPE_ERROR = "בקשה לא תקינה.";

export function validateDonationIntent(payload: unknown): IntentValidation {
  const parsed = donationIntentSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: SHAPE_ERROR, fields: {} };
  }

  const data = parsed.data;
  const fields = validateDonationForm({
    presetAmount: data.amount,
    customAmount: "",
    dedicationType: data.dedicationType,
    dedicationName: data.dedicationName,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    email: data.email,
  });
  const [firstMessage] = Object.values(fields);
  return firstMessage
    ? { ok: false, message: firstMessage, fields }
    : { ok: true, data };
}

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** שורה להכנסה לטבלת donations (סטטוס, id ו-ref נקבעים במסד) */
export function toDonationInsert(data: DonationIntentInput) {
  const dedicationText = composeDedication(
    data.dedicationType,
    data.dedicationName,
  );
  const hasDedication = dedicationText !== "";
  return {
    amount: data.amount,
    currency: 1,
    frequency: data.frequency === "monthly" ? "monthly" : "one_time",
    dedication_type: hasDedication ? data.dedicationType : null,
    dedication_name: hasDedication ? data.dedicationName.trim() : null,
    dedication_text: hasDedication ? dedicationText : null,
    donor_first_name: emptyToNull(data.firstName),
    donor_last_name: emptyToNull(data.lastName),
    donor_phone: emptyToNull(data.phone),
    donor_email: emptyToNull(data.email),
  };
}
