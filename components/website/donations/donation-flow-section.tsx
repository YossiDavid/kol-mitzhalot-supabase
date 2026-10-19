import { connection } from "next/server";

import { KIND_LABELS } from "@/features/dedications/lib/dedication-model";
import {
  DEDICATION_QUERY_PARAM,
  buildDedicationOffer,
  parseSponsorKindParam,
  type DedicationOffer,
} from "@/features/dedications/lib/dedication-prices";
import { israelDateOf } from "@/features/dedications/lib/israel-date";
import { listCurrentDedications } from "@/features/dedications/lib/public-dedications";
import { listDedicationPrices } from "@/features/dedications/lib/public-dedication-prices";
import type { SponsorKind } from "@/features/dedications/lib/dedication-model";
import { DonationFlow } from "./donation-flow";

interface DonationFlowSectionProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mosadId: string;
  apiValid: string;
}

type PurchaseState =
  | { type: "none" }
  | { type: "offer"; offer: DedicationOffer }
  | { type: "unavailable"; kind: SponsorKind };

/**
 * הצעת הרכישה לסוג שבכתובת: יש מחיר, והמשבצת לא תפוסה היום (כמו הקובייה).
 * חפיפה עם הקדשה עתידית באותה תקופה נבדקת בשרת ביצירת הכוונה (409).
 */
async function resolvePurchase(kind: SponsorKind): Promise<PurchaseState> {
  const today = israelDateOf(new Date());
  try {
    const [prices, current] = await Promise.all([
      listDedicationPrices(),
      listCurrentDedications(today),
    ]);
    const offer = buildDedicationOffer(kind, prices, today);
    const isTaken = current.some((item) => item.kind === kind);
    return offer && !isTaken
      ? { type: "offer", offer }
      : { type: "unavailable", kind };
  } catch (error: unknown) {
    console.error("[donations] הצעת הפרנס לא נטענה", error);
    return { type: "unavailable", kind };
  }
}

/**
 * הטופס בדף התרומות. ?dedication=sponsor_day (מקובייה פנויה עם מחיר) פותח מצב
 * רכישה: סכום נעול, חד־פעמי, והקדשה ושם חובה. סוג לא מוכר מתעלמים ממנו; סוג
 * בלי מחיר או תפוס: הודעה, ומתחתיה תרומה רגילה. לעטוף ב-<Suspense>.
 */
export async function DonationFlowSection({
  searchParams,
  mosadId,
  apiValid,
}: DonationFlowSectionProps) {
  const params = await searchParams;
  await connection();
  const kind = parseSponsorKindParam(params[DEDICATION_QUERY_PARAM]);
  const purchase: PurchaseState = kind
    ? await resolvePurchase(kind)
    : { type: "none" };
  const offer = purchase.type === "offer" ? purchase.offer : null;

  return (
    <>
      {purchase.type === "unavailable" && (
        <p
          role="status"
          data-testid="dedication-offer-unavailable"
          className="mb-6 rounded-xl border border-border bg-card p-4 text-body-sm text-muted-foreground"
        >
          {KIND_LABELS[purchase.kind]} אינו זמין כעת לרכישה. אפשר לתרום תרומה
          רגילה, ולהקדיש אותה בטופס.
        </p>
      )}
      {/* key: מעבר בין רכישה לתרומה רגילה (או בין סוגים) מתחיל טופס נקי */}
      <DonationFlow
        key={offer?.kind ?? "donation"}
        mosadId={mosadId}
        apiValid={apiValid}
        offer={offer}
      />
    </>
  );
}

/** שלד בזמן טעינת הטופס */
export function DonationFlowFallback() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-48 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
