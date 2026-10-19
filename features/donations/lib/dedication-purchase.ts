/**
 * בדיקות השרת לרכישת פרנס, לפני יצירת הכוונה. Callers: app/api/v1/donations/intent.
 * המחיר נקרא עדכני מהמסד (לא מהקאש), והסכום חייב להיות שווה לו בדיוק. התקופה
 * נקבעת כאן מהיום בישראל, ולא מהלקוח. משבצת שיש בה הקדשה מפורסמת חופפת: 409.
 * הסכום שנשלח בפועל ל-iframe נבדק שוב ב-record_nedarim_payment (אי-התאמה = mismatch,
 * ואז לא נוצרת הקדשה).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  KIND_LABELS,
  type SponsorKind,
} from "@/features/dedications/lib/dedication-model";
import {
  dedicationPurchasePeriod,
  isValidDedicationPrice,
} from "@/features/dedications/lib/dedication-prices";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import type { DedicationPeriod } from "./intent";

const LOG_TAG = "[donations/intent]";

export const PURCHASE_ERRORS = {
  notForSale: "הפרנס הזה אינו זמין כעת לרכישה. אפשר לתרום תרומה רגילה.",
  amountMismatch: (label: string, price: number) =>
    `הסכום של ${label} הוא ${price.toLocaleString("he-IL")} ₪.`,
  slotTaken: (label: string) =>
    `${label} כבר הוקדש לתקופה הזו. אפשר לתרום תרומה רגילה.`,
} as const;

export type PurchaseCheck =
  | { ok: true; period: DedicationPeriod }
  | { ok: false; status: 400 | 409 | 500; message?: string };

async function loadPrice(
  db: SupabaseClient,
  kind: SponsorKind,
): Promise<number | null | "error"> {
  const { data, error } = await db
    .from("dedication_prices")
    .select("amount")
    .eq("kind", kind)
    .maybeSingle();
  if (error) {
    console.error(LOG_TAG, "price lookup failed", describeSupabaseError(error));
    return "error";
  }
  const amount = Number(data?.amount);
  return data && isValidDedicationPrice(amount) ? amount : null;
}

export async function checkDedicationPurchase(
  db: SupabaseClient,
  kind: SponsorKind,
  amount: number,
  today: string,
): Promise<PurchaseCheck> {
  const label = KIND_LABELS[kind];
  const price = await loadPrice(db, kind);
  if (price === "error") return { ok: false, status: 500 };
  if (price === null) {
    return { ok: false, status: 400, message: PURCHASE_ERRORS.notForSale };
  }
  if (amount !== price) {
    return {
      ok: false,
      status: 400,
      message: PURCHASE_ERRORS.amountMismatch(label, price),
    };
  }

  const period = dedicationPurchasePeriod(kind, today);
  const { data: taken, error } = await db.rpc("dedication_slot_taken", {
    p_kind: kind,
    p_starts_on: period.starts_on,
    p_ends_on: period.ends_on,
  });
  if (error) {
    console.error(LOG_TAG, "slot check failed", describeSupabaseError(error));
    return { ok: false, status: 500 };
  }
  if (taken === true) {
    return {
      ok: false,
      status: 409,
      message: PURCHASE_ERRORS.slotTaken(label),
    };
  }
  return { ok: true, period };
}
