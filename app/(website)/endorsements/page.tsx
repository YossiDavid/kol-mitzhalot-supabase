import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { WebCta } from "@/components/website/cta";
import { EndorsementCard } from "@/components/website/endorsement-card";
import { fetchPublishedEndorsements } from "@/lib/endorsements";

export const metadata: Metadata = {
  title: "הסכמות והמלצות רבנים",
  description:
    "הסכמות והמלצות של רבני הקהילה למערכת קול מצהלות. לחיצה על ההסכמה מציגה אותה בגודל מלא.",
};

async function EndorsementsGrid() {
  const endorsements = await fetchPublishedEndorsements();

  if (!endorsements.length) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <p className="text-subtitle font-bold text-primary">
          הסכמות הרבנים יפורסמו כאן בקרוב
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">חזרה לדף הבית</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <p className="mb-8 text-center text-body-sm font-bold text-primary">
        {endorsements.length} הסכמות והמלצות
      </p>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {endorsements.map((item) => (
          <li key={item.id}>
            <EndorsementCard item={item} />
          </li>
        ))}
      </ul>
    </>
  );
}

function EndorsementsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="h-[420px] animate-pulse rounded-2xl bg-border"
        />
      ))}
    </div>
  );
}

export default function EndorsementsPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 bg-brand-gold-wash" />
        <div className="relative shell-site flex flex-col items-center justify-center py-16 text-center md:py-24">
          <h1 className="text-hero max-w-5xl text-balance text-primary-foreground">
            הסכמות והמלצות
            <br />
            <span
              className="mt-3 inline-block rounded-xl"
              style={{
                background: "var(--brand-gold)",
                color: "var(--brand-gold-foreground)",
                padding: "1px 20px 6px",
                transform: "rotate(-1.5deg)",
              }}
            >
              רבני הקהילה
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-subtitle text-primary-foreground/85">
            דברי הרבנים שבירכו את מערכת קול מצהלות. לחיצה על ההסכמה מציגה אותה
            בגודל מלא.
          </p>
        </div>
      </section>

      <section className="bg-secondary">
        <div className="shell-site py-16 md:py-20">
          <Suspense fallback={<EndorsementsSkeleton />}>
            <EndorsementsGrid />
          </Suspense>
        </div>
      </section>

      <WebCta />
    </>
  );
}
