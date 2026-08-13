import Link from "next/link";
import { Suspense } from "react";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";
import { WebCta } from "@/components/website/cta";
import {
  CvFillPreview,
  ParentsProductPreview,
  PremiumListingPreview,
  PrivacyPreview,
  ProposalReplyPreview,
} from "@/components/website/product-previews";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    q: "לא מקבלים מספיק הצעות משדכנים?",
    a: 'אולי הם לא מכירים אתכם מספיק! מלאו עכשיו כרטיס קו"ח בקול מצהלות, הרחיבו ככל האפשר בפרטים האישיים, המשפחתיים והתעסוקתיים ועזרו לעשרות השדכנים במערכת להכיר אתכם טוב יותר ולהציע הצעות מתאימות יותר!',
    premium: false,
  },
  {
    q: "הפרטיות חשובה לכם? גם לנו!",
    a: 'אין יותר קבצי קו"ח ותמונות שמסתובבות אצל מי יודע מי! כרטיסי הקו"ח בקול מצהלות חשופים לשדכנים מקצועיים בלבד שזוהו ואושרו על ידי המערכת, רק אתם מחליטים ומאשרים למי ומתי להראות את התמונות שלכם, והמידע שלכם נשאר תמיד בידיים שלכם וניתן לשינויים ועריכות מתי שתרצו!',
    premium: false,
  },
  {
    q: "מגיבים בקלות על כל הצעה שמקבלים!",
    a: "כבר לא צריך להתקשר באי נעימות בשביל לדחות הצעה! מגיבים לשדכן על ההצעה ישירות מתוך המערכת, בוחרים אם מעוניינים להתקדם, לברר או להוריד, מפרטים אם רוצים להוסיף משהו נוסף ומתנהלים מול השדכן בקלות ובנוחות!",
    premium: false,
  },
  {
    q: "רוצים לקבל יותר הצעות?",
    a: 'שדרגו למנוי פרימיום בקול מצהלות! כרטיס הקו"ח שלכם יבלוט מעל שאר השמות שמופיעים לשדכנים ברשימה, תוכלו לציין סכום דמי שדכנות גבוה יותר שימשוך שדכנים נוספים להציע לכם ותקבלו יותר הצעות שיובילו לסגירת השידוך המתאים בקלות ובמהירות בעז"ה!',
    premium: true,
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

function FeatureCopy({
  q,
  a,
  premium,
}: {
  q: string;
  a: string;
  premium: boolean;
}) {
  return (
    <div>
      {premium ? (
        <span className="mb-3 inline-block rounded-md bg-brand-gold-muted px-3 py-1.5 text-body-sm font-semibold text-brand-gold-foreground">
          פרימיום
        </span>
      ) : null}
      <h2 className="mb-4 text-title leading-snug font-bold text-primary">
        {q}
      </h2>
      <p className="text-body text-foreground/80">{a}</p>
    </div>
  );
}

const FEATURE_VISUALS = [
  <CvFillPreview key="cv" className="min-h-0" />,
  <PrivacyPreview key="privacy" className="min-h-0" />,
  <ProposalReplyPreview key="reply" className="min-h-0" />,
  <PremiumListingPreview key="premium" className="min-h-0" />,
];

export default function ParentsPage() {
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
              הורים ומיועדים
            </h1>
            <p className="mb-10 max-w-2xl text-subtitle text-primary-foreground/85">
              מערכת קול מצהלות תוכננה ונבנתה במיוחד על מנת לסייע לשדכנים להציע
              לכם יותר הצעות מתאימות, כך שתוכלו למצוא את הבאשערטע בקלות ובמהירות
              רבה בעז"ה!
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
              <ParentsProductPreview className="min-h-0 border-white/15" />
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
                <FeatureCopy q={f.q} a={f.a} premium={f.premium} />
                {FEATURE_VISUALS[i]}
              </>
            ) : (
              <>
                {FEATURE_VISUALS[i]}
                <FeatureCopy q={f.q} a={f.a} premium={f.premium} />
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
