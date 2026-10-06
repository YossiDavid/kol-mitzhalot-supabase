/**
 * הגדרות וולידציה של טופס התרומה (טהור, ללא React).
 */
import { isValidPhone, PHONE_INVALID_MESSAGE } from "@/lib/phone";
import {
  DONATION_AMOUNT_MAX,
  DONATION_AMOUNT_MIN,
  DONOR_ID_MAX_DIGITS,
  DONOR_ID_MIN_DIGITS,
  containsForbiddenLink,
  isDonorIdRequired,
  isValidDonationAmount,
  isValidDonorId,
  isValidEmail,
  normalizeDonorId,
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
  /** מספר זהות: נשאר בדפדפן ונשלח רק ל-iframe של הספק, לא לשרת שלנו */
  donorId: string;
}

/** הערכים שנשלחים לשרת ומאומתים גם שם (בלי מספר הזהות) */
export type DonationIntentValues = Omit<DonationFormValues, "donorId">;

export type DonationFormField =
  | "amount"
  | "dedicationName"
  | "phone"
  | "email"
  | "donorId";

export type DonationFormErrors = Partial<Record<DonationFormField, string>>;

/** סכום שנבחר: מותאם אישית גובר על הצעה קבועה. NaN כשלא נבחר דבר */
export function resolveAmount(values: DonationIntentValues): number {
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

export const DONOR_ID_INVALID_MESSAGE = `מספר הזהות צריך להכיל ${DONOR_ID_MIN_DIGITS} עד ${DONOR_ID_MAX_DIGITS} ספרות.`;
export const DONOR_ID_REQUIRED_MESSAGE =
  "הוראת קבע באשראי דורשת מספר תעודת זהות.";

/** וולידציה לצד הלקוח בלבד: לא חלק מהכוונה, ולכן אינה רצה בשרת */
export function validateDonorId(
  raw: string,
  frequency: DonationFrequency,
): DonationFormErrors {
  if (!normalizeDonorId(raw)) {
    return isDonorIdRequired(frequency)
      ? { donorId: DONOR_ID_REQUIRED_MESSAGE }
      : {};
  }
  return isValidDonorId(raw) ? {} : { donorId: DONOR_ID_INVALID_MESSAGE };
}

/** כל כללי הטופס בדפדפן: הכללים המשותפים עם השרת, ובנוסף מספר הזהות */
export function validateDonationFormClient(
  values: DonationFormValues,
  frequency: DonationFrequency,
): DonationFormErrors {
  return {
    ...validateDonationForm(values),
    ...validateDonorId(values.donorId, frequency),
  };
}

export function validateDonationForm(
  values: DonationIntentValues,
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
