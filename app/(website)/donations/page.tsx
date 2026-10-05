/**
 * עמוד ציבורי: תרומות והנצחות. התשלום מתבצע בתוך iframe מאובטח של נדרים פלוס
 * (שיטה 3), בלי מפתח API בצד הלקוח. Callers: כפתור התרומות בהדר, בפוטר ובתפריט המערכת.
 */
import type { Metadata } from "next";
import { Lock, ReceiptText } from "lucide-react";
import { DedicationsSection } from "@/components/website/donations/dedications-section";
import { DonationFlow } from "@/components/website/donations/donation-flow";
import { DonationUnavailable } from "@/components/website/donations/donation-unavailable";
import { resolveNedarimConfig } from "@/features/donations/lib/nedarim";

export const metadata: Metadata = {
  title: "תרומות והנצחות",
  description:
    "מערכת קול מצהלות פתוחה לכל המשפחות ללא עלות. תרומתכם מאפשרת לנו להמשיך להפעיל אותה ולפתח אותה, אפשר גם להקדיש או להנציח.",
};

const REASSURANCES = [
  {
    icon: Lock,
    title: "תשלום מאובטח",
    text: "התשלום מתבצע במסך המאובטח של נדרים פלוס. פרטי האשראי אינם עוברים דרך האתר שלנו.",
  },
  {
    icon: ReceiptText,
    title: "קבלה",
    text: "קבלה על התרומה מופקת על ידי נדרים פלוס לאחר התשלום.",
  },
] as const;

export default function DonationsPage() {
  const config = resolveNedarimConfig({
    mosadId: process.env.NEXT_PUBLIC_NEDARIM_MOSAD_ID,
    apiValid: process.env.NEXT_PUBLIC_NEDARIM_API_VALID,
  });

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 bg-brand-gold-wash" />
        <div className="relative shell-site flex flex-col items-center justify-center py-24 text-center md:py-28">
          <h1 className="text-hero text-primary-foreground">תרומות והנצחות</h1>
          <p className="mt-8 max-w-2xl text-subtitle text-primary-foreground/85">
            המערכת של קול מצהלות פתוחה לכל המשפחות, ללא עלות. תרומתכם היא מה
            שמאפשר לנו להמשיך להפעיל אותה, לתחזק אותה ולהרחיב אותה.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="shell-site grid grid-cols-1 gap-12 py-16 md:py-20 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
          <div>
            <h2 className="mb-8 text-display font-bold text-primary">
              לתרום למערכת
            </h2>
            {config ? (
              <DonationFlow
                mosadId={config.mosadId}
                apiValid={config.apiValid}
              />
            ) : (
              <DonationUnavailable />
            )}
          </div>

          <aside className="flex flex-col gap-8 lg:pt-16">
            {REASSURANCES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-subtitle font-bold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      </section>

      <DedicationsSection />
    </>
  );
}
