/**
 * שליפת מחירי הפרנס לאתר הציבורי (קוביות "פנוי" ודף התרומות).
 * Callers: components/website/dedications/dedication-tiles-section.tsx,
 *   components/website/donations/donation-flow-section.tsx.
 *
 * אנונימית ובקאש, תחת אותו תג של הקוביות: שמירת מחירים בניהול מפקיעה אותו
 * (updateTag), וכך גם תשלום שיצר הקדשה (revalidateTag ב-webhook).
 * כוונת התרומה בשרת אינה משתמשת בזה: היא קוראת את המחיר העדכני ישירות.
 */
import { cacheLife, cacheTag } from "next/cache";

import { DEDICATIONS_CACHE_TAG } from "@/features/dedications/lib/dedications-cache";
import {
  toDedicationPrices,
  type DedicationPrices,
} from "@/features/dedications/lib/dedication-prices";
import { createClient } from "@/lib/supabase/public";

const REVALIDATE_SECONDS = 60;
const STALE_SECONDS = 30;
const EXPIRE_SECONDS = 600;

export async function listDedicationPrices(): Promise<DedicationPrices> {
  "use cache";
  cacheLife({
    stale: STALE_SECONDS,
    revalidate: REVALIDATE_SECONDS,
    expire: EXPIRE_SECONDS,
  });
  cacheTag(DEDICATIONS_CACHE_TAG);

  const { data, error } = await createClient()
    .from("dedication_prices")
    .select("kind, amount");

  if (error) {
    console.error("[dedications] טעינת מחירי הפרנס נכשלה", error);
    throw new Error("DEDICATION_PRICES_FETCH_FAILED");
  }
  return toDedicationPrices(data ?? []);
}
