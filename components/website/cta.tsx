import Section from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function WebCta() {
  return (
    <Section className="bg-primary text-primary-foreground" containerClassName="py-16">
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <h2 className="text-primary-foreground">מערכת קול מצהלות כאן בשבילכם, הירשמו עכשיו!</h2>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" variant="secondary">
            <Link href="/auth/sign-up">הרשמת הורים ומיועדים</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/auth/sign-up">הרשמת שדכנים ושדכניות</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/auth/sign-up">הרשמת רבנים וצוותי חינוך</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
