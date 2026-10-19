import { DedicationPeriodText } from "@/features/dedications/components/dedication-period-text";
import type { DedicationOffer } from "@/features/dedications/lib/dedication-prices";

/** ראש הטופס ברכישת פרנס: הסוג, המחיר הנעול והתקופה שנרכשת */
export function DedicationOfferHeader({ offer }: { offer: DedicationOffer }) {
  return (
    <div
      data-testid="dedication-offer"
      data-kind={offer.kind}
      className="flex flex-col gap-2 rounded-xl border border-brand-gold p-5 bg-primary-wash"
    >
      <h3 className="text-title font-bold text-primary">
        {offer.label} – {offer.amount.toLocaleString("he-IL")} ₪
      </h3>
      <p className="text-body-sm text-muted-foreground">
        <DedicationPeriodText startsOn={offer.startsOn} endsOn={offer.endsOn} />
      </p>
      <p className="text-body-sm text-muted-foreground">
        ההקדשה ושם התורם יופיעו בקובייה באתר מיד לאחר אישור התשלום. התשלום
        חד־פעמי, בסכום הקבוע של {offer.label}.
      </p>
    </div>
  );
}
