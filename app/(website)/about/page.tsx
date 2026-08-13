import { Suspense } from "react";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";
import { WebCta } from "@/components/website/cta";

function HighlightSpan({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block rounded-[11px]"
      style={{
        background: "var(--primary)",
        color: "var(--primary-foreground)",
        padding: "1px 14px 4px",
        transform: "rotate(-1.5deg)",
      }}
    >
      {children}
    </span>
  );
}

const stories = [
  {
    title: "בזכות שיחות עם הורים דואגים",
    desc: "שלא מקבלים הצעות רלוונטיות, שמרגישים שהשדכנים לא מכירים את הבן או הבת שלהם, שהצעות טובות נתקעות להם פשוט בגלל תקשורת לקויה וחוסר הבנה מול השדכנים.",
  },
  {
    title: "בזכות בקשות של עלטערע בחורים ומיועדי פרק ב' כאובים",
    desc: "שהולכים ומתבגרים, כמעט ולא מקבלים הצעות למרות היותם מצוינים ואיכותיים, אך רוב השדכנים מעדיפים להתעסק עם השידוכים הקלים בלבד והם כבר מתחילים לאבד את התקווה.",
  },
  {
    title: "בזכות דיונים עם שדכנים מותשים",
    desc: "שמתמודדים עם מקצוע שוחק ולא מתגמל, עומס אדיר של מידע שקשה לזכור, הורים שלא מגיבים להצעות, קושי לברר על מיועדים ואתגר אדיר בניהול תהליך מורכב מול 2 הצדדים.",
  },
  {
    title: "ובזכות התייעצויות עם רבנים, דיינים וצוותי חינוך",
    desc: "שרואים את המצב הקשה ההולך ומחמיר בקהילתנו הק' וביקשו למצוא פתרון יסודי ויצירתי לבעיה, שיסייע הן להורים, הן למיועדים והן לשדכנים, בהקמת בתים נאמנים בישראל.",
  },
];

const processSteps = [
  {
    num: "01",
    title: "הורים או מיועדים בוגרים",
    desc: 'ממלאים כרטיס קו"ח מפורט שעולה למערכת ומוצג לשדכנים מורשים בלבד, מקבלים הצעות ומגיבים עליהם בקלות, וכך מסייעים לשדכנים להציע הצעות רבות יותר ומתאימות יותר.',
  },
  {
    num: "02",
    title: "רבנים, דיינים וצוותי החינוך במוסדות",
    desc: 'כותבים על כרטיסי הקו"ח א גוט ווארט ומחמאות מהכירותם האישית עם המיועדים, ובכך מסייעים לשדכנים להכיר אותם טוב יותר.',
  },
  {
    num: "03",
    title: "השדכנים והשדכניות במערכת",
    desc: "מקבלים את כל המידע בצורה מסודרת, צופים ומכירים לעומק את המיועדים, יוצרים הצעות שידוכים, שולחים אותן לצדדים ישירות מתוך המערכת ומקבלים תגובות מהירות.",
  },
  {
    num: "04",
    title: "השידוכים עצמם",
    desc: 'מתקדמים ומתנהלים בצורה יעילה, מהירה וקלה יותר לכל הצדדים, בתקשורת נוחה תוך שמירה על פרטיות וצניעות עד למציאת הבאשערטע וסגירת השידוך למזל טוב בעז"ה.',
  },
];

export default function AboutPage() {
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

        <div className="relative shell-site flex flex-col items-center justify-center py-28 text-center md:py-36">
          <h1 className="max-w-5xl text-hero text-balance text-primary-foreground">
            קול מצהלות הוקמה
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
              בזכותכם
            </span>
          </h1>
        </div>
      </section>

      {/* ── 2. OPENING STORIES ── */}
      <section className="bg-background">
        <div className="shell-site py-20 md:py-24">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            {stories.map(({ title, desc }) => (
              <article
                key={title}
                className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-8 md:p-9"
              >
                <h2 className="text-title leading-snug font-bold text-primary">
                  {title}
                </h2>
                <p className="text-body text-foreground/80">
                  {desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. SUMMARY ── */}
      <section className="bg-secondary">
        <div className="shell-site py-20 md:py-24">
          <div className="mx-auto w-[65vw] max-w-5xl text-center max-md:w-[92%]">
            <h2 className="mb-8 text-display font-bold text-primary">
              בזכותכם,
              <br />
              <HighlightSpan>יצאנו לדרך.</HighlightSpan>
            </h2>
            <p className="mb-5 text-body text-foreground/80">
              לא מתוך מחשבה להמציא מחדש את עולם השידוכים, המתנהל בדרך אבותינו הק'
              מזה דורי דורות, אלא במטרה לשמור על הקיים ולהכניס לתוכו כלי עזר
              וסיוע הנצרך בעקבות המצב, לבנות מערכת טכנולוגית שתקל על ההורים, על
              המיועדים ובעיקר על השדכנים, מבלי לפגום במעמד הקדוש של הקמת בית
              בישראל.
            </p>
            <p className="mb-8 text-body text-foreground/80">
              וכך, בברכת הקודש של כ"ק מרן אדמו"ר שליט"א ובהכוונתם של רבני
              קהילתנו הק' ובראשם הגה"צ ר' שמאי גרוס שליט"א והגה"צ ר' שמואל יעקב
              לנדאו שליט"א, עם תכנון ומחשבה על כל פרט ופרט, ועם צוות מסור של
              אנשי מעשה מומחים ויראי שמיים – נרתמנו למלאכה.
            </p>
            <p className="text-subtitle font-bold text-primary">
              מערכת קול מצהלות — הפתרון המושלם לנושא השידוכים בקהילתנו הק'.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. HOW IT WORKS ── */}
      <section className="bg-background">
        <div className="shell-site py-20 md:py-24">
          <div className="mb-14 text-center md:mb-16">
            <h2 className="text-display leading-[1.08] font-bold text-foreground">
              כך עובדת
              <br />
              <HighlightSpan>המערכת</HighlightSpan>
            </h2>
          </div>

          <div className="border-t border-border">
            {processSteps.map(({ num, title, desc }) => (
              <div
                key={num}
                className="grid grid-cols-[4.5rem_1fr] items-baseline gap-5 border-b border-border py-10 md:grid-cols-[7.5rem_1fr] md:gap-12 md:py-12"
              >
                <div
                  className="text-display leading-none font-normal text-primary/35"
                  aria-hidden="true"
                >
                  {num}
                </div>
                <div className="grid grid-cols-1 items-baseline gap-4 md:grid-cols-[minmax(16rem,38%)_1fr] md:gap-12">
                  <h3 className="text-title leading-snug font-bold text-foreground">
                    {title}
                  </h3>
                  <p className="text-start text-body text-foreground/80 md:text-end">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WebStats />

      <Suspense>
        <RabbinicalEndorsements />
      </Suspense>

      <WebCta />
    </>
  );
}
