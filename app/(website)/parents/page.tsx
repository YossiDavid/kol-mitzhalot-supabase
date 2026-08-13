import Link from "next/link";
import { Suspense } from "react";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";

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

const SECTION_BG = ["bg-background", "bg-muted"];

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function ImagePlaceholder() {
  return (
    <div className="bg-primary-stripe aspect-video rounded-2xl border border-dashed border-border" />
  );
}

export default function ParentsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto px-6 py-24 text-center" style={{ maxWidth: 1120 }}>
          <h1
            className="font-bold text-primary-foreground text-display" style={{marginBottom: 20, lineHeight: 1.1}}
          >
            הורים ומיועדים
          </h1>
          <p className="mx-auto mb-10 text-subtitle leading-[1.65] opacity-90" style={{ maxWidth: 640 }}>
            מערכת קול מצהלות תוכננה ונבנתה במיוחד על מנת לסייע לשדכנים להציע לכם יותר הצעות מתאימות, כך שתוכלו למצוא את הבאשערטע בקלות ובמהירות רבה בעז"ה!
          </p>
          <Link
            href={"/auth/sign-up" as any}
            className="inline-flex items-center gap-[9px] rounded-full bg-brand-gold-gradient px-[34px] py-4 text-body font-extrabold text-brand-gold-foreground no-underline shadow-[0_20px_40px_-16px_rgba(0,0,0,.55)] transition-transform hover:-translate-y-0.5"
          >
            הירשמו עכשיו ללא עלות <ArrowIcon />
          </Link>
        </div>
      </section>

      {/* Feature sections — alternating layout */}
      {FEATURES.map((f, i) => (
        <section key={i} className={SECTION_BG[i % 2]}>
          <div
            className="mx-auto grid grid-cols-1 items-center gap-8 px-6 md:grid-cols-2 md:gap-12"
            style={{ maxWidth: 1120, paddingTop: 70, paddingBottom: 70 }}
          >
            {i % 2 === 0 ? (
              <>
                <div>
                  {f.premium && (
                    <span className="mb-3 inline-block rounded-full bg-brand-gold-muted px-3 py-1.5 text-body-sm font-semibold text-brand-gold-foreground">
                      פרימיום
                    </span>
                  )}
                  <h2
                    className="font-bold text-primary text-heading" style={{marginBottom: 16, lineHeight: 1.3}}
                  >
                    {f.q}
                  </h2>
                  <p className="text-body leading-[1.75] text-muted-foreground">{f.a}</p>
                </div>
                <ImagePlaceholder />
              </>
            ) : (
              <>
                <ImagePlaceholder />
                <div>
                  {f.premium && (
                    <span className="mb-3 inline-block rounded-full bg-brand-gold-muted px-3 py-1.5 text-body-sm font-semibold text-brand-gold-foreground">
                      פרימיום
                    </span>
                  )}
                  <h2
                    className="font-bold text-primary text-heading" style={{marginBottom: 16, lineHeight: 1.3}}
                  >
                    {f.q}
                  </h2>
                  <p className="text-body leading-[1.75] text-muted-foreground">{f.a}</p>
                </div>
              </>
            )}
          </div>
        </section>
      ))}

      <WebStats />
      <Suspense><RabbinicalEndorsements /></Suspense>

      {/* Bottom CTA */}
      <section className="bg-background">
        <div className="mx-auto px-6 py-16 text-center" style={{ maxWidth: 1120 }}>
          <Link
            href={"/auth/sign-up" as any}
            className="inline-flex items-center gap-[9px] rounded-full bg-primary px-[34px] py-4 text-body font-extrabold text-primary-foreground no-underline shadow-primary-cta transition-transform hover:-translate-y-0.5"
          >
            הירשמו עכשיו ללא עלות <ArrowIcon />
          </Link>
        </div>
      </section>
    </>
  );
}
