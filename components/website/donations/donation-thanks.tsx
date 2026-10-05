import { Button } from "@/components/ui/button";
import type { DonationConfirmation } from "./use-donation-confirmation";

export const THANKS_HEADING = "תודה רבה!";
export const THANKS_TEXT =
  "תרומתכם התקבלה, והיא מסייעת לנו להמשיך להפעיל את המערכת ולהקים בתים נאמנים בישראל. קבלה תישלח אליכם מנדרים פלוס.";

export const CONFIRMATION_TEXT: Record<DonationConfirmation, string> = {
  processing: "התרומה בעיבוד",
  confirmed: "התרומה התקבלה ונרשמה",
};

interface DonationThanksProps {
  confirmation: DonationConfirmation;
  onAnotherDonation: () => void;
}

/** תודה בתוך העמוד אחרי תרומה מוצלחת, עם אפשרות לתרומה נוספת */
export function DonationThanks({
  confirmation,
  onAnotherDonation,
}: DonationThanksProps) {
  return (
    <div
      role="status"
      data-testid="donation-thanks"
      className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 md:p-8"
    >
      <h3 className="text-display font-bold text-primary">{THANKS_HEADING}</h3>
      <p className="text-body text-muted-foreground">{THANKS_TEXT}</p>
      <p
        data-testid="donation-confirmation"
        className="text-caption text-muted-foreground"
      >
        {CONFIRMATION_TEXT[confirmation]}
      </p>
      <Button type="button" onClick={onAnotherDonation}>
        תרומה נוספת
      </Button>
    </div>
  );
}
