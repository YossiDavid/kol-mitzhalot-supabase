import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * מוצג במקום הטופס כשמספר המוסד בנדרים פלוס חסר או לא תקין:
 * לא בונים קישור שבור, אלא מפנים ליצירת קשר.
 */
export function DonationUnavailable() {
  return (
    <div
      role="status"
      data-testid="donation-unavailable"
      className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card p-6 md:p-8"
    >
      <h3 className="text-subtitle font-bold text-foreground">
        התרומה המקוונת אינה זמינה כרגע
      </h3>
      <p className="text-body text-muted-foreground">
        נשמח מאוד לתמיכתכם. אפשר לפנות אלינו ונסייע בתרומה או בהנצחה בדרך אחרת.
      </p>
      <Button asChild>
        <Link href="/contact">צרו קשר</Link>
      </Button>
    </div>
  );
}
