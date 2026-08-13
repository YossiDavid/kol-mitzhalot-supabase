import Link from "next/link";
import { Suspense } from "react";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";
import { createClient } from "@/lib/supabase/server";

const CATEGORY_LABELS: Record<string, string> = {
  parents: "להורים",
  singles: "למיועדים",
  shadchanim: "לשדכנים",
  general: "כללי",
};

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

function CheckSvg({
  size = 18,
  stroke = "var(--primary)",
  strokeWidth = "2.5",
}: {
  size?: number;
  stroke?: string;
  strokeWidth?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowSmall() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

const tickerItems = [
  "מערכת חדשנית להצעות וניהול שידוכים",
  'מאגר מתעדכן ונוח עם מיועדים ומיועדות מאנ"ש',
  "רשימת שדכנים נבחרים בקהילתנו הק׳",
  "פורום שדכנים מתקדם לשיתוף מידע והתייעצות",
  "בהמלצת ובפיקוח רבני קהילתינו הק׳",
  "מערכת חדשנית להצעות וניהול שידוכים",
];

const steps = [
  {
    num: "01",
    title: "הורים או מיועדים בוגרים",
    desc: 'ממלאים כרטיס קו"ח מפורט שעולה למערכת ומוצג לשדכנים מורשים בלבד.',
  },
  {
    num: "02",
    title: "רבנים, משפיעים וצוות מוסדות החינוך",
    desc: "כותבים על הכרטיס א גוט ווארט ומחמאות, מהכירותם האישית עם המיועדים.",
  },
  {
    num: "03",
    title: "השדכנים והשדכניות במערכת",
    desc: "צופים ומכירים לעומק את המיועדים, יוצרים הצעות שידוכים ושולחים אותן ישירות מהמערכת.",
  },
  {
    num: "04",
    title: "שני הצדדים שקיבלו את ההצעה",
    desc: "מגיבים ישירות לשדכנים במקום ובזמן שנוח, ומקדמים את השידוך המתאים בקלות.",
  },
];

const audiences = [
  {
    title: "הורים ומיועדים",
    desc: 'שדכנים לא מתקשרים להציע? רוצים שעוד שדכנים מקצועיים יכירו אתכם? מערכת קול מצהלות עוזרת לשדכנים להכיר אתכם ולהציע לכם הצעות שמתאימות בדיוק לכם! מלאו עכשיו כרטיסי קו"ח מלאים ומפורטים, קבלו הצעות מדויקות משדכנים ובעז"ה תמצאו את הזיווג בקרוב ממש!',
    features: [
      { title: "פרטיות מובטחת!", desc: "רק שדכנים מורשים חשופים למידע שלכם" },
      { title: "שיח פתוח ומהיר!", desc: "מתכתבים עם השדכן ישירות מתוך המערכת" },
      {
        title: "קידום VIP!",
        desc: 'מצטרפים למנוי פרימיום ונהנים מקידום הקו"ח לכל השדכנים',
      },
    ],
    cta: "לקול מצהלות להורים ומיועדים",
    href: "/parents" as any,
  },
  {
    title: "שדכנים ושדכניות",
    desc: 'שורפים שעות על בירורים בסיסיים? הולכים לאיבוד בתוך ים הניירת? הצטרפו לקול מצהלות ותהנו ממאגר מידע עדכני עם קו"ח מפורטים של כלל המיועדים בבעלזא, אפשרויות חיפוש ומיון מתקדמות, שמירת שמות מועדפים, שליחת הצעות וניהול השידוכים ישירות מתוך המערכת!',
    features: [
      {
        title: "מאגר מתעדכן!",
        desc: "עם אפשרויות חיפוש, סינון, מיון, שיתוף וייעוץ מהיר",
      },
      {
        title: "ניהול שידוכים!",
        desc: "יוצרים הצעות שידוך, שולחים לצדדים ומקבלים משוב בקלות",
      },
      { title: "בדיקת הצעות", desc: "בדיקה אוטומטית חכמה לפני שליחת ההצעה" },
    ],
    cta: "לקול מצהלות לשדכנים",
    href: "/shadchanim" as any,
  },
  {
    title: "רבנים וצוותי חינוך",
    desc: "רוצים לסייע לתלמידים ולתלמידות שלכם במציאת שידוך מתאים בקלות? הירשמו עכשיו למערכת קול מצהלות וקבלו גישה אישית לכתיבת מחמאות ותשבחות על כרטיסי המיועדים המתחנכים אצלכם, ובכך תסייעו לשדכנים להכיר אותם טוב יותר, להבריק את הרעיון הנכון ולמצוא להם את הבאשערטע!",
    features: [
      { title: "פרטיות מובטחת!", desc: "רק שדכנים מורשים חשופים למה שכתבתם" },
      {
        title: "חיסכון בזמן!",
        desc: "במקום לענות לכל המבררים כותבים פעם אחת וזהו",
      },
      { title: "חסד אמיתי!", desc: "המחמאה שלכם יכולה לגרום לשידוך להגיע" },
    ],
    cta: "להרשמה מהירה ללא עלות",
    href: "/auth/sign-up" as any,
  },
];

const principles = [
  {
    cardClass: "bg-primary-muted text-primary",
    svgColor: "color-mix(in oklab, var(--primary) 8%, transparent)",
    titleClass: "text-primary",
    descClass: "text-muted-foreground",
    title: 'הכוונה וליווי מקיף של רבני הארגון שליט"א',
    desc: 'הארגון הוקם על ידי שדכנים ועסקנים יר"ש, ומתנהל בליווי והכוונה שוטפים של הגה"צ ר׳ שמאי גרוס והגה"צ ר׳ שמואל יעקב לנדאו.',
  },
  {
    cardClass: "bg-brand-gold-muted text-brand-gold-foreground",
    svgColor: "color-mix(in oklab, var(--brand-gold) 18%, transparent)",
    titleClass: "text-brand-gold-foreground",
    descClass: "text-brand-gold-foreground/80",
    title: "פרטיות ואבטחת מידע ללא פשרות",
    desc: "אנו מתייחסים במלוא הרצינות לפרטיות שלכם! המערכת משתמשת בתקני אבטחה מתקדמים במיוחד, וההנהלה בודקת לעומק כל שדכן לפני מתן גישה למידע.",
  },
  {
    cardClass: "bg-muted text-foreground",
    svgColor: "color-mix(in oklab, var(--primary) 6%, transparent)",
    titleClass: "text-foreground",
    descClass: "text-muted-foreground",
    title: 'התנהלות ערכית וללא חשש לשה"ר',
    desc: "המערכת בנויה ברוח התורה והחסידות: אין אפשרות לכתוב מידע שלילי, כל תגובה נבדקת לפני פרסומה ותמונות נשלחות תוך שמירה מוקפדת על פרטיות וצניעות.",
  },
];

function ArticleCard({
  slug,
  cat,
  date,
  read,
  title,
  excerpt,
}: {
  slug: string;
  cat: string;
  date: string;
  read: string;
  title: string;
  excerpt: string;
}) {
  return (
    <Link
      href={`/knowledge/${slug}` as any}
      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card no-underline shadow-[0_1px_3px_rgba(20,40,40,.06)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(20,40,40,.28)]"
    >
      <div
        className="bg-primary-stripe relative flex aspect-[16/10] items-center justify-center font-mono text-caption text-muted-foreground"
      >
        [ תמונת נושא ]
        <span className="absolute top-[14px] right-[14px] rounded-full bg-card/94 px-3 py-[5px] text-caption font-bold text-primary shadow-[0_2px_6px_rgba(20,40,40,.12)]">
          {cat}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-[10px] p-[22px_24px]">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>{date}</span>
          <span className="h-[3px] w-[3px] rounded-full bg-border" />
          <span>{read}</span>
        </div>
        <h3
          className="text-subtitle leading-[1.35] font-bold text-foreground"
          style={{ margin: 0 }}
        >
          {title}
        </h3>
        <p
          className="text-body-sm leading-[1.6] text-muted-foreground"
          style={{ margin: 0 }}
        >
          {excerpt}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-[9px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-primary/12">
              <LogoSvg size={15} className="text-primary" />
            </span>
            <span className="text-caption font-semibold text-muted-foreground">
              מערכת קול מצהלות
            </span>
          </div>
          <span className="inline-flex items-center gap-[5px] text-body-sm font-bold text-primary">
            לקריאה{" "}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

async function HomepageEngagements() {
  const supabase = await createClient();
  const { data: engagements } = await supabase
    .from("engagements")
    .select("id, groom_name, bride_name, groom_city")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!engagements?.length) return null;

  return (
    <section className="bg-background">
      <div
        className="mx-auto px-6"
        style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}
      >
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2
            className="font-bold text-primary text-display" style={{lineHeight: 1.1,
              margin: 0}}
          >
            שידוכים שנסגרו
            <br />
            <HighlightSpan>למזל טוב</HighlightSpan>
          </h2>
          <div className="flex gap-[10px]">
            {[
              { label: "לכל מה שחדש", href: "/whats-new" as any },
              { label: "לעדכון מודעת מאורסים", href: "/contact" as any },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="rounded-[8px] border border-border px-4 py-[9px] text-body-sm font-bold text-primary no-underline transition-colors hover:bg-muted"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {engagements.map((e) => (
            <div
              key={e.id}
              className="flex flex-col items-center justify-center rounded-[14px] border border-border bg-card p-4 text-center"
              style={{ aspectRatio: "3/4" }}
            >
              <div className="mb-1 text-body-sm font-bold text-foreground">
                {e.groom_name}
              </div>
              <div className="mb-2 text-caption text-muted-foreground">&</div>
              <div className="text-body-sm font-bold text-foreground">
                {e.bride_name}
              </div>
              {e.groom_city && (
                <div className="mt-3 text-caption text-muted-foreground">
                  {e.groom_city}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

async function HomepageKnowledge() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, category, read_time_minutes, published_at",
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(3);

  if (!articles?.length) return null;

  return (
    <section className="bg-muted">
      <div
        className="mx-auto px-6"
        style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}
      >
        <div className="mx-auto mb-12 max-w-[640px] text-center">
          <h2
            className="font-bold text-primary text-display" style={{lineHeight: 1.1,
              marginBottom: 12}}
          >
            מרכז הידע של
            <br />
            <HighlightSpan>קול מצהלות</HighlightSpan>
          </h2>
          <p className="text-subtitle text-muted-foreground" style={{ margin: 0 }}>
            כל מה שחשוב לדעת על שידוכים, בירורים, פגישות, אירוסין ומה שביניהם.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard
              key={a.id}
          slug={a.slug}
              cat={CATEGORY_LABELS[a.category] ?? a.category}
              date={
                a.published_at
                  ? new Date(a.published_at).toLocaleDateString("he-IL")
                  : ""
              }
              read={`${a.read_time_minutes} דק׳ קריאה`}
              title={a.title}
              excerpt={a.excerpt}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        {/* Decorative watermark */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_negative.svg"
          alt=""
          aria-hidden="true"
          width={640}
          height={640}
          className="pointer-events-none absolute select-none"
          style={{ top: -120, left: -80, opacity: 0.06 }}
        />

        <div
          className="relative mx-auto grid grid-cols-1 items-center gap-8 px-6 pt-[74px] pb-[84px] text-right md:grid-cols-[1.05fr_.95fr] md:gap-14"
          style={{ maxWidth: 1200 }}
        >
          {/* Floating gold badge — hidden on mobile */}
          <Link
            href={"/contact" as any}
            className="absolute hidden flex-col items-center justify-center gap-1 rounded-full border-[3px] border-white text-center text-body-sm font-extrabold text-brand-gold-foreground no-underline transition-transform hover:scale-[1.06] md:flex"
            style={{
              top: 24,
              left: 24,
              width: 118,
              height: 118,
              background: "radial-gradient(circle at 33% 27%,var(--brand-gold-soft),var(--brand-gold))",
              boxShadow:
                "0 4px 0 rgba(20,50,48,.18),0 22px 36px -14px rgba(0,0,0,.6)",
              transform: "rotate(-8deg)",
              zIndex: 4,
            }}
          >
            <span style={{ lineHeight: 1.18 }}>
              יש לי
              <br />
              רעיון
              <br />
              לשידוך
            </span>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </Link>

          {/* Text column */}
          <div>
            <p
              className="mb-[18px] max-w-[540px] leading-[1.6] opacity-80 text-subtitle" style={{fontWeight: 500}}
            >
              שדכנים, הורים, אנשי ונשות חינוך, מחפשי שידוך בוגרים או בזיווג שני,
              וכל מי שיש לו רעיון לשידוך ורוצה לסייע להקים עוד בית נאמן בישראל:
            </p>
            <p
              className="mb-1 font-medium opacity-90 text-title"
            >
              ברוכים הבאים ל
            </p>
            <h1
              className="leading-none font-bold tracking-[-0.02em] text-primary-foreground text-display" style={{marginBottom: 12}}
            >
              קול מצהלות
            </h1>
            <p
              className="font-bold opacity-[.92] text-title" style={{marginBottom: 32}}
            >
              הארגון לקידום שידוכים בבעלזא
            </p>

            {/* Animated ticker */}
            <div className="mb-[34px] flex max-w-[560px] items-center gap-[11px]">
              <CheckSvg size={22} stroke="currentColor" strokeWidth="2.4" />
              <div className="h-[44px] flex-1 overflow-hidden">
                <div
                  className="ticker-roller"
                  style={{
                    animation: "roll 16s cubic-bezier(.7,0,.3,1) infinite",
                    willChange: "transform",
                  }}
                >
                  {tickerItems.map((item, i) => (
                    <div
                      key={i}
                      className="overflow-hidden font-semibold text-ellipsis whitespace-nowrap text-subtitle" style={{height: 44, lineHeight: "44px"}}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap justify-start gap-3">
              <Link
                href={"/auth/sign-up" as any}
                className="rounded-full px-7 py-[14px] text-body font-bold text-primary no-underline transition-colors hover:bg-card"
                style={{
                  background: "var(--primary-foreground)",
                  boxShadow: "0 10px 26px -12px rgba(0,0,0,.5)",
                }}
              >
                הירשמו עכשיו ללא עלות
              </Link>
              <Link
                href={"/contact" as any}
                className="rounded-full border border-primary-foreground/40 bg-transparent px-7 py-[14px] text-body font-bold text-primary-foreground no-underline transition-colors hover:bg-primary-foreground/10"
              >
                דברו איתנו
              </Link>
            </div>
          </div>

          {/* Visual column */}
          <div className="relative">
            <div
              className="overflow-hidden rounded-[18px] bg-card"
              style={{
                boxShadow: "0 34px 80px -34px rgba(0,0,0,.6)",
                border: "1px solid rgba(255,255,255,.16)",
                transform: "rotate(-1.2deg)",
              }}
            >
              {/* Browser chrome */}
              <div className="flex gap-[6px] border-b border-border bg-muted px-4 py-[13px]">
                {[1, 2, 3].map((d) => (
                  <span
                    key={d}
                    className="h-[9px] w-[9px] rounded-full bg-border"
                  />
                ))}
              </div>
              <div className="p-4">
                <div className="bg-primary-stripe-sm flex aspect-[4/3] items-center justify-center rounded-[10px] border border-border p-[18px] text-center font-mono text-caption text-muted-foreground">
                  [ צילום מסך · ממשק
                  <br />
                  ניהול השידוכים ]
                </div>
              </div>
            </div>

            {/* Floating toast — hidden on mobile */}
            <div
              className="absolute hidden items-center gap-[10px] rounded-[12px] bg-card md:flex"
              style={{
                bottom: -18,
                left: -16,
                border: "1px solid var(--border)",
                boxShadow: "0 18px 40px -18px rgba(0,0,0,.4)",
                padding: "12px 16px",
                transform: "rotate(2deg)",
              }}
            >
              <span className="bg-primary-wash flex h-[30px] w-[30px] items-center justify-center rounded-[9px]">
                <CheckSvg size={17} strokeWidth="2.6" />
              </span>
              <span className="text-right">
                <span className="block text-body-sm font-bold text-foreground">
                  הצעה נשלחה
                </span>
                <span className="block text-caption text-muted-foreground">
                  ממתינה לתגובת הצדדים
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. MISSION ── */}
      <section className="bg-background">
        <div
          className="mx-auto grid grid-cols-1 items-center gap-8 px-6 py-[76px] md:grid-cols-[1.1fr_.9fr] md:gap-14"
          style={{ maxWidth: 1120 }}
        >
          <div>
            <h2
              className="font-bold text-primary text-display" style={{lineHeight: 1.1,
                marginBottom: 18}}
            >
              המטרה
              <br />
              <HighlightSpan>שלנו ושלכם</HighlightSpan>
            </h2>
            <p className="mb-4 text-body leading-[1.75] text-muted-foreground">
              לקדם שידוכים ולהקים בתים נאמנים בישראל. בסייעתא דשמיא, בברכת הקודש
              ובהכוונת רבנים חשובים בקהילתינו הק׳, הושקעו משאבים רבים בסיוע
              נדיבים על מנת להקים את מערכת קול מצהלות, מתוך תחושת שליחות, אחריות
              ורצון לקדם את ענייני השידוכים בקהילתנו.
            </p>
            <p className="mb-5 text-body leading-[1.75] text-muted-foreground">
              המערכת נועדה לשמש ככתובת לכל נושא השידוכים בקהילתנו הק׳ וככלי עזר
              נוח להורים, שדכנים, רבנים ואנשי ונשות החינוך במוסדותינו ברחבי
              העולם, במטרה לסייע במציאת זיווג הגון בדרך קלה ונוחה, תוך שמירה על
              ערכי הקדושה וצנעת הפרט, ללא חשש לשה"ר ובליווי הלכתי ורוחני מלא.
            </p>
            <Link
              href={"/about" as any}
              className="inline-flex items-center gap-[6px] text-body font-bold text-primary no-underline"
            >
              עוד על קול מצהלות <ArrowSmall />
            </Link>
          </div>

          {/* Endorsement slider placeholder */}
          <div className="relative">
            <p className="mb-3 text-center text-body-sm font-bold tracking-[.02em] text-primary">
              הסכמות והמלצות רבני קהילתנו הק׳
            </p>
            <div className="relative">
              <div className="bg-primary-stripe-sm flex aspect-[4/5] items-center justify-center rounded-2xl border border-dashed border-border p-[22px] text-center font-mono text-body-sm text-muted-foreground shadow-sm">
                [ תמונת הסכמת רב · סליידר ]
              </div>
              {/* Nav arrows */}
              {[
                { side: "left", d: "m15 18-6-6 6-6" },
                { side: "right", d: "m9 18 6-6-6-6" },
              ].map(({ side, d }) => (
                <button
                  key={side}
                  aria-label={side === "right" ? "הבא" : "הקודם"}
                  className="absolute top-1/2 flex h-[40px] w-[40px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-primary shadow-[0_8px_18px_-8px_rgba(0,0,0,.35)] transition-colors hover:bg-muted"
                  style={{ [side]: -16 }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={d} />
                  </svg>
                </button>
              ))}
            </div>
            {/* Dots */}
            <div className="mt-4 flex justify-center gap-[7px]">
              <span
                className="h-[7px] rounded-full bg-primary"
                style={{ width: 22 }}
              />
              {[1, 2, 3].map((d) => (
                <span
                  key={d}
                  className="h-[7px] w-[7px] rounded-full bg-border"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. STATS ── */}
      <WebStats />

      {/* ── 4. HOW IT WORKS ── */}
      <section className="bg-muted">
        <div
          className="mx-auto px-6"
          style={{ maxWidth: 1160, paddingTop: 90, paddingBottom: 90 }}
        >
          {/* Section header */}
          <div className="mb-[52px] grid grid-cols-1 items-end gap-6 md:grid-cols-[1.35fr_1fr] md:gap-11">
            <div>
              <div className="mb-4 text-body-sm font-bold tracking-[.16em] text-primary">
                — איך זה עובד
              </div>
              <h2
                className="font-bold text-foreground text-display" style={{lineHeight: 1.02,
                  letterSpacing: "-.02em",
                  margin: 0}}
              >
                איך עובדת מערכת
                <br />
                <span className="text-primary">קול מצהלות?</span>
              </h2>
            </div>
            <p
              className="mb-[10px] text-body leading-[1.7] text-muted-foreground"
              style={{ margin: 0 }}
            >
              בשילוב מושלם של טכנולוגיה, מידע, שיתוף ובברכת רבני קהילתינו הק׳.
            </p>
          </div>

          {/* Step rows */}
          <div className="border-t border-border">
            {steps.map(({ num, title, desc }) => (
              <div
                key={num}
                className="grid grid-cols-[64px_1fr] items-baseline gap-5 border-b border-border py-7 md:grid-cols-[96px_1fr] md:gap-7"
              >
                <div
                  className="leading-none font-normal text-muted-foreground text-display"
                >
                  {num}
                </div>
                <div className="grid grid-cols-1 items-baseline gap-3 md:grid-cols-[minmax(200px,280px)_1fr] md:gap-7">
                  <h3
                    className="font-bold text-foreground text-title" style={{margin: 0,
                      lineHeight: 1.3}}
                  >
                    {title}
                  </h3>
                  <p
                    className="text-end text-body leading-[1.65] text-muted-foreground"
                    style={{ margin: 0 }}
                  >
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Photo strip */}
          <div className="mt-[52px] grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-muted"
                style={{ aspectRatio: "4/3" }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. WHO IS IT FOR ── */}
      <section className="bg-background">
        <div
          className="mx-auto px-6"
          style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}
        >
          <div className="mx-auto mb-12 max-w-[640px] text-center">
            <h2
              className="font-bold text-primary text-display" style={{lineHeight: 1.1,
                marginBottom: 12}}
            >
              למי המערכת
              <br />
              <HighlightSpan>מתאימה?</HighlightSpan>
            </h2>
            <p className="text-subtitle text-muted-foreground" style={{ margin: 0 }}>
              לכל העוסקים בתחום כמקצוע, כשליחות, או עבור עצמם, ילדיהם ותלמידיהם.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {audiences.map(({ title, desc, features, cta, href }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-[30px]"
                style={{ boxShadow: "0 4px 14px -8px rgba(20,40,40,.12)" }}
              >
                <h3
                  className="text-title font-bold text-primary"
                  style={{ margin: 0 }}
                >
                  {title}
                </h3>
                <p
                  className="text-body leading-[1.65] text-muted-foreground"
                  style={{ margin: 0 }}
                >
                  {desc}
                </p>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {features.map(({ title: ft, desc: fd }) => (
                    <li key={ft} className="flex items-start gap-[9px]">
                      <CheckSvg />
                      <span className="text-body">
                        <b className="text-foreground">{ft}</b>
                        <br />
                        <span className="text-muted-foreground">{fd}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className="mt-auto rounded-[10px] bg-primary px-[18px] py-3 text-center text-body font-bold text-primary-foreground no-underline transition-colors hover:bg-primary-active"
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PRINCIPLES ── */}
      <section className="bg-muted">
        <div
          className="mx-auto px-6"
          style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}
        >
          <div className="mb-[52px] grid grid-cols-1 items-end gap-6 md:grid-cols-[1fr_auto] md:gap-8">
            <div style={{ maxWidth: 660 }}>
              <span className="mb-5 inline-block rounded-[8px] bg-muted px-[14px] py-1.5 text-caption font-bold tracking-[.14em] text-primary">
                עקרונות
              </span>
              <h2
                className="font-bold text-foreground text-display" style={{lineHeight: 1.12,
                  letterSpacing: "-.01em",
                  marginBottom: 18,
                  marginTop: 0}}
              >
                העקרונות של
                <br />
                <span
                  className="inline-block rounded-[12px]"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                    padding: "1px 16px 5px",
                    transform: "rotate(-1.5deg)",
                  }}
                >
                  קול מצהלות
                </span>
              </h2>
              <p
                className="max-w-[520px] text-body leading-[1.7] text-muted-foreground"
                style={{ margin: 0 }}
              >
                הכללים שלנו נוסחו מתוך הבנת האחריות העצומה והרגישות הנדרשת
                בתחום.
              </p>
            </div>
            <Link
              href={"/auth/sign-up" as any}
              className="inline-flex items-center gap-2 rounded-[11px] bg-foreground px-[30px] py-[15px] text-body font-bold whitespace-nowrap text-background no-underline transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              הצטרפו עכשיו <ArrowSmall />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[22px] md:grid-cols-3">
            {principles.map(
              ({ cardClass, svgColor, titleClass, descClass, title, desc }) => (
                <div
                  key={title}
                  className={`relative flex min-h-[236px] flex-col items-center justify-center overflow-hidden rounded-[18px] p-[40px_30px] text-center ${cardClass}`}
                >
                  <LogoSvg
                    size={220}
                    className="pointer-events-none absolute"
                    style={
                      {
                        color: svgColor,
                        bottom: -60,
                        left: -50,
                      } as React.CSSProperties
                    }
                  />
                  <h3
                    className={`relative mb-3.5 text-subtitle leading-[1.3] font-bold ${titleClass}`}
                  >
                    {title}
                  </h3>
                  <p className={`relative m-0 text-body leading-[1.7] ${descClass}`}>
                    {desc}
                  </p>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ── 7. SCREENSHOTS ── */}
      <section className="bg-background">
        <div
          className="mx-auto px-6"
          style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}
        >
          <div className="mx-auto mb-12 max-w-[640px] text-center">
            <h2
              className="font-bold text-primary text-display" style={{lineHeight: 1.1,
                marginBottom: 12}}
            >
              איך זה נראה
              <br />
              <HighlightSpan>מבפנים?</HighlightSpan>
            </h2>
            <p className="text-subtitle text-muted-foreground" style={{ margin: 0 }}>
              מה בדיוק עושים? מה האפשרויות שם? כנסו לראות!
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                title: "מערכת קול מצהלות להורים ולמיועדים",
                href: "/parents" as any,
              },
              { title: "מערכת קול מצהלות לשדכנים", href: "/shadchanim" as any },
            ].map(({ title, href }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-[14px] border border-border bg-card p-[22px]"
                style={{ boxShadow: "0 1px 3px rgba(20,40,40,.06)" }}
              >
                <div className="overflow-hidden rounded-[10px] border border-border">
                  <div className="flex gap-[6px] border-b border-border bg-muted px-[14px] py-[10px]">
                    {[1, 2, 3].map((d) => (
                      <span
                        key={d}
                        className="h-[9px] w-[9px] rounded-full bg-border"
                      />
                    ))}
                  </div>
                  <div className="bg-primary-stripe-xs flex aspect-video items-center justify-center p-4 text-center font-mono text-caption text-muted-foreground">
                    [ צילום מסך ]
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p
                    className="text-body font-bold text-foreground"
                    style={{ margin: 0 }}
                  >
                    {title}
                  </p>
                  <Link
                    href={href}
                    className="inline-flex shrink-0 items-center gap-[5px] rounded-[8px] border border-border px-[14px] py-2 text-body-sm font-bold text-primary no-underline transition-colors hover:bg-muted"
                  >
                    כנסו לראות <ArrowSmall />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. ENDORSEMENTS ── */}
      <Suspense>
        <RabbinicalEndorsements />
      </Suspense>

      {/* ── 9. RECENT ENGAGEMENTS — hidden when no data ── */}
      <Suspense>
        <HomepageEngagements />
      </Suspense>

      {/* ── 10. KNOWLEDGE PREVIEW — hidden when no data ── */}
      <Suspense>
        <HomepageKnowledge />
      </Suspense>

      {/* ── FINAL CTA ── */}
      <div
        style={{
          background: "linear-gradient(180deg,var(--muted) 0%,var(--background) 100%)",
        }}
      >
        <WebCta />
      </div>
    </>
  );
}
