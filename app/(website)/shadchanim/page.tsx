import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";
import { WebCta } from "@/components/website/cta";
import {
  DirectoryProductPreview,
  ProposalCheckPreview,
  ProposalTrackingPreview,
  ResumeDetailPreview,
  ShadchanForumPreview,
  ShadchanimProductPreview,
} from "@/components/website/product-previews";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    q: "שורפים שעות על בירורים בסיסיים?",
    a: "במאגר המידע המתעדכן של קול מצהלות תמצאו רשימה מסודרת ויעילה של כל מיועדי ומיועדות קהילתנו הק', עם אפשרות מיון וסינון מתקדמות במיוחד, ובלחיצת כפתור אחת תוכלו לבקש ולקבל מידע נוסף על כל שם במאגר מכלל שדכני המערכת!",
  },
  {
    q: "הולכים לאיבוד בתוך ים הניירת והצעטאלא'ך?",
    a: 'בקול מצהלות תהנו מכרטיסי קו"ח מסודרים ומפורטים במיוחד עם מספר ההצעות שכבר התקבלו ועם כל המידע האישי, המשפחתי והתעסוקתי של המיועד או המיועדת, שמולאו על ידי ההורים או המיועדים בעצמם!',
  },
  {
    q: 'לא עוד: "איך לא חשבתי על ההצעה הזו בעצמי"',
    a: "קול מצהלות מביאה לכם פתרון מושלם עם לוח עבודה חדשני שיעזור לכם ליצור יותר הצעות! פשוט מסמנים שמות מעניינים מתוך המאגר, בוחרים מתוכם את המיועדים המועדפים, חושבים על הצעות מתאימות, יוצרים אותם בקלות ואפילו מקבלים פידבק אוטומטי חכם שבודק אם ההצעה הוצעה בעבר.",
  },
  {
    q: "הצעות טובות נופלות לכם בין הכסאות?",
    a: 'אין יותר הצעות שסתם יורדות! שולחים את ההצעות ישירות מהמערכת, מקבלים תגובה מהירה משני הצדדים אם הם רוצים להתקדם או לא ומדוע, וכך עוקבים אחרי כל הצעה ומדייקים את ההצעות הבאות עד לסגירת שידוך בעז"ה!',
  },
  {
    q: "צריכים דעה נוספת? עזרה בבירורים? ייעוץ בהתנהלות?",
    a: "פורום השדכנים והשדכניות של קול מצהלות נועד בדיוק עבור זה! כאן תוכלו לשאול ולברר כל דבר בנושא שידוכים, בממשק חדשני ונוח, בהפרדה מלאה ובפיקוח רוחני מלא!",
  },
];

const SECTION_BG = ["bg-background", "bg-secondary"];

function ArrowIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function FeatureCopy({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h2 className="mb-4 text-title leading-snug font-bold text-primary">
        {q}
      </h2>
      <p className="text-body text-foreground/80">{a}</p>
    </div>
  );
}

function featureVisual(index: number): ReactNode {
  const className = "min-h-0";
  if (index === 0) return <DirectoryProductPreview className={className} />;
  if (index === 1) return <ResumeDetailPreview className={className} />;
  if (index === 2) return <ProposalCheckPreview className={className} />;
  if (index === 3) return <ProposalTrackingPreview className={className} />;
  return <ShadchanForumPreview className={className} />;
}

export default function ShadchanPage() {
  return (
    <>
      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="bg-brand-gold-wash pointer-events-none absolute inset-0" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_negative.svg"
          alt=""
          aria-hidden="true"
          width={720}
          height={720}
          className="pointer-events-none absolute -top-28 -left-24 opacity-[0.07] select-none"
        />

        <div className="relative shell-site grid grid-cols-1 items-center gap-12 py-16 md:grid-cols-[1.1fr_0.9fr] md:gap-16 md:py-24">
          <div className="min-w-0">
            <h1 className="mb-5 text-hero text-primary-foreground">
              שדכנים ושדכניות
            </h1>
            <p className="mb-10 max-w-2xl text-subtitle text-primary-foreground/85">
              מערכת קול מצהלות תוכננה ונבנתה במיוחד עבורכם, והיא כאן כדי לפתור את
              כל האתגרים שאתם מתמודדים איתם בהצעת וניהול שידוכים.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-brand-gold text-brand-gold-foreground hover:bg-brand-gold-soft active:bg-brand-gold-muted"
            >
              <Link href={"/auth/sign-up" as any}>
                הירשמו עכשיו ללא עלות <ArrowIcon />
              </Link>
            </Button>
          </div>

          <div className="relative min-w-0">
            <div className="-rotate-[1.2deg]">
              <ShadchanimProductPreview className="min-h-0 border-white/15" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature sections — alternating layout */}
      {FEATURES.map((f, i) => (
        <section key={f.q} className={SECTION_BG[i % 2]}>
          <div className="shell-site grid grid-cols-1 items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-20">
            {i % 2 === 0 ? (
              <>
                <FeatureCopy q={f.q} a={f.a} />
                {featureVisual(i)}
              </>
            ) : (
              <>
                {featureVisual(i)}
                <FeatureCopy q={f.q} a={f.a} />
              </>
            )}
          </div>
        </section>
      ))}

      <WebStats />
      <Suspense>
        <RabbinicalEndorsements />
      </Suspense>

      {/* CTA קודם — כפתור גלולה בתחתית העמוד
      <section className="bg-background">
        <div className="mx-auto px-6 py-16 text-center" style={{ maxWidth: 1120 }}>
          <Link href={"/auth/sign-up" as any} className="...">
            הירשמו עכשיו ללא עלות
          </Link>
        </div>
      </section>
      */}
      <WebCta />
    </>
  );
}
