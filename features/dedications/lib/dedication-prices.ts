/**
 * מחירי פרנס היום / השבוע / החודש ורכישתם בדף התרומות (טהור, בלי React ובלי מסד).
 * Callers: קוביות הפרנס (קישור "פנוי"), דף התרומות (מצב רכישה), כוונת התרומה
 * בשרת (בדיקת הסכום והתקופה), וטופס המחירים בניהול.
 *
 * אין מחיר לסוג = אין רכישה: הקובייה הפנויה מפנה לתרומה רגילה, כמקודם.
 * הנצחה אינה נרכשת (אין לה קובייה פנויה), ולכן אין לה מחיר.
 */
import { z } from "zod";

import { defaultDatesForKind } from "@/features/dedications/lib/dedication-defaults";
import {
  KIND_LABELS,
  SPONSOR_KINDS_LARGEST_FIRST,
  type SponsorKind,
} from "@/features/dedications/lib/dedication-model";
import {
  DONATION_AMOUNT_MAX,
  DONATION_AMOUNT_MIN,
  isValidDonationAmount,
} from "@/features/donations/lib/nedarim";

/** מחיר בשקלים שלמים לכל סוג שהוגדר; סוג חסר = לא נמכר */
export type DedicationPrices = Partial<Record<SponsorKind, number>>;

/** פרמטר החיפוש בדף התרומות שמסמן רכישת פרנס */
export const DEDICATION_QUERY_PARAM = "dedication";

/** יעד הקובייה הפנויה כשיש מחיר: דף התרומות במצב רכישה, גלול לטופס */
export function dedicationPurchaseHref(kind: SponsorKind): string {
  return `/donations?${DEDICATION_QUERY_PARAM}=${kind}#donate`;
}

/** הערך מה-URL כסוג פרנס, או null לכל ערך אחר (כולל הנצחה) */
export function parseSponsorKindParam(
  raw: string | string[] | undefined,
): SponsorKind | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SPONSOR_KINDS_LARGEST_FIRST.find((kind) => kind === value) ?? null;
}

/** מחיר תקין: מספר שלם בטווח התרומה (לפחות מינימום התרומה) */
export function isValidDedicationPrice(amount: number): boolean {
  return isValidDonationAmount(amount);
}

export const DEDICATION_PRICE_INVALID_MESSAGE = `המחיר צריך להיות מספר שלם בין ${DONATION_AMOUNT_MIN} ל־${DONATION_AMOUNT_MAX.toLocaleString("he-IL")} ש״ח, או ריק (ללא רכישה).`;

/** שורות הטבלה dedication_prices למפה; שורות לא תקינות נזרקות */
export function toDedicationPrices(
  rows: ReadonlyArray<{ kind: unknown; amount: unknown }>,
): DedicationPrices {
  return Object.fromEntries(
    rows.flatMap(({ kind, amount }) => {
      const sponsorKind = parseSponsorKindParam(
        typeof kind === "string" ? kind : undefined,
      );
      const price = Number(amount);
      return sponsorKind && isValidDedicationPrice(price)
        ? [[sponsorKind, price]]
        : [];
    }),
  );
}

/** התקופה שנרכשת היום (YYYY-MM-DD בישראל): יום, שבוע ראשון-שבת, או החודש העברי */
export function dedicationPurchasePeriod(
  kind: SponsorKind,
  today: string,
): { starts_on: string; ends_on: string } {
  return defaultDatesForKind(kind, today);
}

/** הצעת רכישה שמוצגת בטופס התרומה: סוג, מחיר נעול ותקופה */
export interface DedicationOffer {
  kind: SponsorKind;
  label: string;
  amount: number;
  startsOn: string;
  endsOn: string;
}

export function buildDedicationOffer(
  kind: SponsorKind,
  prices: DedicationPrices,
  today: string,
): DedicationOffer | null {
  const amount = prices[kind];
  if (amount === undefined) return null;
  const period = dedicationPurchasePeriod(kind, today);
  return {
    kind,
    label: KIND_LABELS[kind],
    amount,
    startsOn: period.starts_on,
    endsOn: period.ends_on,
  };
}

/** טופס המחירים בניהול: מחרוזת ריקה = ללא מחיר (הסוג לא נמכר) */
const priceField = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d+$/.test(value) && isValidDedicationPrice(Number(value))),
    DEDICATION_PRICE_INVALID_MESSAGE,
  );

export const dedicationPricesFormSchema = z.object({
  sponsor_day: priceField,
  sponsor_week: priceField,
  sponsor_month: priceField,
});

export type DedicationPricesFormValues = z.infer<
  typeof dedicationPricesFormSchema
>;

export function toPricesFormValues(
  prices: DedicationPrices,
): DedicationPricesFormValues {
  const text = (kind: SponsorKind) =>
    prices[kind] === undefined ? "" : String(prices[kind]);
  return {
    sponsor_day: text("sponsor_day"),
    sponsor_week: text("sponsor_week"),
    sponsor_month: text("sponsor_month"),
  };
}

/** מה לשמור ומה למחוק אחרי שמירת הטופס */
export function splitPriceChanges(values: DedicationPricesFormValues): {
  upserts: { kind: SponsorKind; amount: number }[];
  deletes: SponsorKind[];
} {
  const kinds = SPONSOR_KINDS_LARGEST_FIRST;
  return {
    upserts: kinds
      .filter((kind) => values[kind] !== "")
      .map((kind) => ({ kind, amount: Number(values[kind]) })),
    deletes: kinds.filter((kind) => values[kind] === ""),
  };
}
