import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { DonationConfirmation } from "./use-donation-confirmation";

export const THANKS_HEADING = "תודה רבה!";
export const THANKS_TEXT =
  "תרומתכם התקבלה, והיא מסייעת לנו להמשיך להפעיל את המערכת ולהקים בתים נאמנים בישראל. קבלה תישלח אליכם מנדרים פלוס.";

export const CONFIRMATION_TEXT: Record<DonationConfirmation, string> = {
  processing: "התרומה בעיבוד",
  confirmed: "התרומה התקבלה ונרשמה",
};

/** ברכישת פרנס: ההקדשה נוצרת בשרת כשהתשלום מאושר */
export const DEDICATION_THANKS_TEXT = "ההנצחה שלך תופיע באתר";

interface DonationThanksProps {
  confirmation: DonationConfirmation;
  onAnotherDonation: () => void;
  /** נרכש פרנס: מציגים שההקדשה תופיע באתר וקישור לדף הבית */
  isDedicationPurchase?: boolean;
}

/** תודה בתוך העמוד אחרי תרומה מוצלחת, עם אפשרות לתרומה נוספת */
export function DonationThanks({
  confirmation,
  onAnotherDonation,
  isDedicationPurchase = false,
}: DonationThanksProps) {
  return (
    <div
      role="status"
      data-testid="donation-thanks"
      className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 md:p-8"
    >
      <h3 className="text-display font-bold text-primary">{THANKS_HEADING}</h3>
      <p className="text-body text-muted-foreground">{THANKS_TEXT}</p>
      {isDedicationPurchase && (
        <p
          data-testid="donation-dedication-thanks"
          className="text-body font-bold text-foreground"
        >
          {DEDICATION_THANKS_TEXT}
        </p>
      )}
      <p
        data-testid="donation-confirmation"
        className="text-caption text-muted-foreground"
      >
        {CONFIRMATION_TEXT[confirmation]}
      </p>
      <div className="flex flex-wrap gap-3">
        {isDedicationPurchase && (
          <Button asChild>
            <Link href="/">לדף הבית</Link>
          </Button>
        )}
        <Button
          type="button"
          variant={isDedicationPurchase ? "outline" : "default"}
          onClick={onAnotherDonation}
        >
          תרומה נוספת
        </Button>
      </div>
    </div>
  );
}
