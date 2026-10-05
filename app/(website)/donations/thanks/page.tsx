/**
 * עמוד תודה עצמאי. התרומה עצמה מציגה תודה בתוך העמוד (DonationFlow), כך שאין יותר
 * הפניה לכאן; העמוד נשאר זמין לקישור ישיר.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  THANKS_HEADING,
  THANKS_TEXT,
} from "@/components/website/donations/donation-thanks";

export const metadata: Metadata = {
  title: "תודה על תרומתכם",
  robots: { index: false },
};

export default function DonationThanksPage() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <div className="pointer-events-none absolute inset-0 bg-brand-gold-wash" />
      <div className="relative shell-site flex flex-col items-center justify-center py-24 text-center md:py-32">
        <h1 className="text-hero text-primary-foreground">{THANKS_HEADING}</h1>
        <p className="mt-8 max-w-2xl text-subtitle text-primary-foreground/85">
          {THANKS_TEXT}
        </p>
        <div className="mt-10">
          <Button
            asChild
            size="lg"
            className="bg-primary-foreground text-primary hover:bg-card hover:text-primary"
          >
            <Link href="/">חזרה לדף הבית</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
