/**
 * מטבעות התרומה. נדרים פלוס תומך בשקל (1) ובדולר (2) בלבד; תשלום בדולר
 * דורש שהאפשרות פעילה במוסד. פאונד אינו נתמך אצל הספק.
 */
export const DONATION_CURRENCIES = [
  { value: "ILS", code: 1, symbol: "₪", label: "שקל" },
  { value: "USD", code: 2, symbol: "$", label: "דולר" },
] as const;

export type DonationCurrency = (typeof DONATION_CURRENCIES)[number]["value"];
export type DonationCurrencyCode = (typeof DONATION_CURRENCIES)[number]["code"];

export const DEFAULT_DONATION_CURRENCY: DonationCurrency = "ILS";

export const DONATION_CURRENCY_VALUES = DONATION_CURRENCIES.map(
  ({ value }) => value,
) as [DonationCurrency, ...DonationCurrency[]];

export function currencyCode(currency: DonationCurrency): DonationCurrencyCode {
  return DONATION_CURRENCIES.find(({ value }) => value === currency)!.code;
}

/** סימן המטבע לפי הקוד שנשמר במסד (donations.currency); לא מוכר = ₪ */
export function currencySymbolForCode(code: number | null | undefined): string {
  return DONATION_CURRENCIES.find((c) => c.code === code)?.symbol ?? "₪";
}

export function formatDonationAmount(
  amount: number,
  currency: DonationCurrency | number = DEFAULT_DONATION_CURRENCY,
): string {
  const symbol =
    typeof currency === "number"
      ? currencySymbolForCode(currency)
      : currencySymbolForCode(currencyCode(currency));
  return `${amount.toLocaleString("he-IL")} ${symbol}`;
}
