/**
 * הגדרות וולידציה של טופס התרומה (טהור, ללא React).
 */
import { isValidPhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import {
  DONATION_AMOUNT_MAX,
  DONATION_AMOUNT_MIN,
  containsForbiddenLink,
  isValidDonationAmount,
  isValidEmail,
  type DonationFrequency,
} from "./nedarim";

export const AMOUNT_PRESETS = [36, 72, 180, 360, 1000] as const;

export const FREQUENCY_OPTIONS: ReadonlyArray<{
  value: DonationFrequency;
  label: string;
  hint: string;
}> = [
  { value: "once", label: "חד־פעמית", hint: "תרומה אחת עכשיו" },
  {
    value: "monthly",
    label: "הוראת קבע חודשית",
    hint: "תמיכה רציפה, בכל חודש",
  },
];

export const NO_DEDICATION = "none";

export const DEDICATION_LINK_MESSAGE =
  "אי אפשר לכלול קישורים בהקדשה. נא להזין שם בלבד.";

export const DEDICATION_TYPES: ReadonlyArray<{ value: string; label: string }> =
  [
    { value: NO_DEDICATION, label: "ללא הקדשה" },
    { value: "לעילוי נשמת", label: "לעילוי נשמת" },
    { value: "לרפואת", label: "לרפואת" },
    { value: "לזכות", label: "לזכות" },
    { value: "להצלחת", label: "להצלחת" },
  ];

export interface DonationFormValues {
  presetAmount: number | null;
  customAmount: string;
  dedicationType: string;
  dedicationName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export type DonationFormField = "amount" | "dedicationName" | "phone" | "email";

export type DonationFormErrors = Partial<Record<DonationFormField, string>>;

/** סכום שנבחר: מותאם אישית גובר על הצעה קבועה. NaN כשלא נבחר דבר */
export function resolveAmount(values: DonationFormValues): number {
  const custom = values.customAmount.trim();
  // טקסט שאינו ספרות בלבד נכשל בבדיקת הטווח (0), ולא נחשב כ"לא נבחר סכום"
  if (custom) return /^\d+$/.test(custom) ? Number(custom) : 0;
  return values.presetAmount ?? Number.NaN;
}

/** מרכיב את טקסט ההקדשה; ריק כשאין הקדשה */
export function composeDedication(type: string, name: string): string {
  const cleanName = name.trim();
  if (type === NO_DEDICATION || !cleanName) return "";
  return `${type} ${cleanName}`;
}

export function validateDonationForm(
  values: DonationFormValues,
): DonationFormErrors {
  const errors: DonationFormErrors = {};
  const amount = resolveAmount(values);

  if (Number.isNaN(amount)) {
    errors.amount = "בחרו סכום או הזינו סכום אחר.";
  } else if (!isValidDonationAmount(amount)) {
    errors.amount = `הסכום צריך להיות מספר שלם בין ${DONATION_AMOUNT_MIN} ל־${DONATION_AMOUNT_MAX.toLocaleString("he-IL")} ש״ח.`;
  }

  if (
    values.dedicationType !== NO_DEDICATION &&
    !values.dedicationName.trim()
  ) {
    errors.dedicationName = "נא להזין את שם מי שמוקדשת התרומה.";
  } else if (
    containsForbiddenLink(
      composeDedication(values.dedicationType, values.dedicationName),
    )
  ) {
    errors.dedicationName = DEDICATION_LINK_MESSAGE;
  }

  if (values.phone.trim() && !isValidPhone(values.phone)) {
    errors.phone = PHONE_INVALID_MESSAGE;
  }

  const email = values.email.trim();
  if (email && !isValidEmail(email)) {
    errors.email = "כתובת המייל אינה תקינה.";
  }

  return errors;
}
