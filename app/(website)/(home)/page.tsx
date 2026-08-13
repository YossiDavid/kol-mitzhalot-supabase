import Link from "next/link";
import { Suspense, type FC, type SVGProps } from "react";
import { WebStats } from "@/components/website/stats";
import { EndorsementsCarousel } from "@/components/website/endorsements-carousel";
import { WebCta } from "@/components/website/cta";
import { LogoSvg } from "@/components/website/logo-svg";
import {
  DirectoryProductPreview,
  ParentsProductPreview,
  ShadchanimProductPreview,
  ArticleCover,
} from "@/components/website/product-previews";
import SignsSvg from "@/assets/icons/signs.svg";
import TrustSvg from "@/assets/icons/trust.svg";
import PrizeSvg from "@/assets/icons/prize.svg";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type SvgIcon = FC<SVGProps<SVGSVGElement>>;

function asSvgIcon(mod: unknown): SvgIcon {
  if (typeof mod === "function") return mod as SvgIcon;
  if (
    mod &&
    typeof mod === "object" &&
    "default" in mod &&
    typeof mod.default === "function"
  ) {
    return mod.default as SvgIcon;
  }
  throw new Error("SVG import did not resolve to a React component");
}

const SignsIcon = asSvgIcon(SignsSvg);
const TrustIcon = asSvgIcon(TrustSvg);
const PrizeIcon = asSvgIcon(PrizeSvg);

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
    Icon: SignsIcon,
    title: 'הכוונה וליווי מקיף של רבני הארגון שליט"א',
    desc: 'הארגון הוקם על ידי שדכנים ועסקנים יר"ש, ומתנהל בליווי והכוונה שוטפים של הגה"צ ר׳ שמאי גרוס והגה"צ ר׳ שמואל יעקב לנדאו.',
  },
  {
    Icon: TrustIcon,
    title: "פרטיות ואבטחת מידע ללא פשרות",
    desc: "אנו מתייחסים במלוא הרצינות לפרטיות שלכם! המערכת משתמשת בתקני אבטחה מתקדמים במיוחד, וההנהלה בודקת לעומק כל שדכן לפני מתן גישה למידע.",
  },
  {
    Icon: PrizeIcon,
    title: 'התנהלות ערכית וללא חשש לשה"ר',
    desc: "המערכת בנויה ברוח התורה והחסידות: אין אפשרות לכתוב מידע שלילי, כל תגובה נבדקת לפני פרסומה ותמונות נשלחות תוך שמירה מוקפדת על פרטיות וצניעות.",
  },
];

function ArticleCard({
  slug,
  cat,
  category,
  date,
  read,
  title,
  excerpt,
}: {
  slug: string;
  cat: string;
  category: string;
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
      <ArticleCover category={category} badge={cat} />
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
          className="text-body-sm text-muted-foreground"
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
      <div className="shell-site py-20">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2
            className="text-display font-bold text-primary"
            style={{ lineHeight: 1.1, margin: 0 }}
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
      <div className="shell-site py-20">
        <div className="mb-14 w-full max-w-5xl text-start md:mx-auto md:text-center">
          <h2
            className="text-display font-bold text-primary"
            style={{ lineHeight: 1.1, marginBottom: 12 }}
          >
            מרכז הידע של
            <br />
            <HighlightSpan>קול מצהלות</HighlightSpan>
          </h2>
          <p
            className="text-subtitle text-muted-foreground"
            style={{ margin: 0 }}
          >
            כל מה שחשוב לדעת על שידוכים, בירורים, פגישות, אירוסין ומה שביניהם.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard
              key={a.id}
              slug={a.slug}
              cat={CATEGORY_LABELS[a.category] ?? a.category}
              category={a.category}
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

async function MissionEndorsementsCarousel() {
  const supabase = await createClient();
  const { data: endorsements } = await supabase
    .from("endorsements")
    .select("id, rav_name, rav_title, image_url, endorsement_text")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (!endorsements?.length) {
    return null;
  }

  return <EndorsementsCarousel items={endorsements} />;
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
          width={720}
          height={720}
          className="pointer-events-none absolute -top-28 -left-24 opacity-[0.07] select-none"
        />

        <div className="relative shell-site grid grid-cols-1 items-center gap-12 py-16 text-right md:grid-cols-[1.1fr_0.9fr] md:gap-16 md:py-24 lg:gap-20">
          {/* Floating gold badge — keep clear of copy on narrow screens */}
          <Link
            href={"/contact" as any}
            className="absolute top-4 left-2 z-10 flex size-[5.75rem] -rotate-[8deg] flex-col items-center justify-center gap-0.5 rounded-full border-[3px] border-white bg-[radial-gradient(circle_at_33%_27%,var(--brand-gold-soft),var(--brand-gold))] text-center text-body-sm leading-none font-extrabold text-brand-gold-foreground no-underline shadow-[0_4px_0_rgba(20,50,48,.18),0_22px_36px_-14px_rgba(0,0,0,.6)] transition-transform hover:scale-[1.06] md:top-8 md:left-3 md:size-35 md:gap-1 md:text-body"
          >
            <span>
              יש לי
              <br />
              רעיון
              <br />
              לשידוך!
            </span>
          </Link>

          {/* Text column */}
          <div className="min-w-0">
            <p className="mb-6 max-w-2xl pe-[6.75rem] text-subtitle leading-[1.2] font-medium text-primary-foreground/85 md:pe-0">
              שדכנים, הורים, אנשי ונשות חינוך, מחפשי שידוך בוגרים או בזיווג שני,
              וכל מי שיש לו רעיון לשידוך ורוצה לסייע להקים עוד בית נאמן בישראל:
            </p>
            <p className="mb-2 text-title font-medium text-primary-foreground/90">
              ברוכים הבאים ל
            </p>
            <h1 className="mb-3 text-hero whitespace-nowrap text-primary-foreground">
              קול מצהלות
            </h1>
            <p className="mb-10 text-title font-bold text-primary-foreground/95">
              הארגון לקידום שידוכים בבעלזא
            </p>

            {/* Animated ticker */}
            <div className="mb-10 flex min-w-0 max-w-3xl items-center gap-3">
              <CheckSvg size={26} stroke="currentColor" strokeWidth="2.4" />
              <div className="h-12 min-w-0 flex-1 overflow-hidden">
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
                      className="overflow-hidden text-body font-semibold text-ellipsis whitespace-nowrap md:text-subtitle"
                      style={{ height: 48, lineHeight: "48px" }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA buttons — DS Button (rounded-md, no marketing pill/shadow) */}
            <div className="flex flex-wrap items-center justify-start gap-3">
              <Button
                asChild
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-card hover:text-primary active:bg-card"
              >
                <Link href={"/auth/sign-up" as any}>הירשמו עכשיו ללא עלות</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/50 text-primary-foreground shadow-none hover:bg-primary-foreground/10 hover:text-primary-foreground active:bg-primary-foreground/15"
              >
                <Link href={"/contact" as any}>דברו איתנו</Link>
              </Button>
            </div>
          </div>

          {/* Visual column */}
          <div className="relative min-w-0">
            <div className="-rotate-[1.2deg]">
              {/* גרסה קודמת — לוח עבודה (אותו צילום כמו בהמשך העמוד)
              <ShadchanimProductPreview className="min-h-0 border-white/15 shadow-[0_34px_80px_-34px_rgba(0,0,0,.55)]" />
              */}
              <DirectoryProductPreview className="min-h-0 border-white/15 shadow-[0_34px_80px_-34px_rgba(0,0,0,.55)]" />
            </div>

            <div className="absolute -bottom-5 -left-4 hidden rotate-[2deg] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,.4)] md:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-wash">
                <CheckSvg size={18} strokeWidth="2.6" />
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

      {/* ── 2. MISSION + ENDORSEMENTS ── */}
      <section className="bg-background">
        <div className="shell-site flex flex-col gap-14 py-20 md:gap-16 md:py-24">
          <div className="mx-auto w-[65vw] max-w-5xl text-center max-md:w-[92%]">
            <h2 className="mb-6 text-display font-bold text-primary">
              המטרה
              <br />
              <HighlightSpan>שלנו ושלכם</HighlightSpan>
            </h2>
            <p className="mb-5 text-body text-foreground/80">
              לקדם שידוכים ולהקים בתים נאמנים בישראל. בסייעתא דשמיא, בברכת הקודש
              ובהכוונת רבנים חשובים בקהילתינו הק׳, הושקעו משאבים רבים בסיוע
              נדיבים על מנת להקים את מערכת קול מצהלות, מתוך תחושת שליחות, אחריות
              ורצון לקדם את ענייני השידוכים בקהילתנו.
            </p>
            <p className="mb-8 text-body text-foreground/80">
              המערכת נועדה לשמש ככתובת לכל נושא השידוכים בקהילתנו הק׳ וככלי עזר
              נוח להורים, שדכנים, רבנים ואנשי ונשות החינוך במוסדותינו ברחבי
              העולם, במטרה לסייע במציאת זיווג הגון בדרך קלה ונוחה, תוך שמירה על
              ערכי הקדושה וצנעת הפרט, ללא חשש לשה"ר ובליווי הלכתי ורוחני מלא.
            </p>
            <Button asChild size="lg" variant="outline">
              <Link href={"/about" as any}>
                עוד על קול מצהלות <ArrowSmall />
              </Link>
            </Button>
          </div>

          <Suspense
            fallback={
              <div className="w-full">
                <p className="mb-6 text-center text-body-sm font-bold tracking-[0.08em] text-primary">
                  הסכמות והמלצות רבני קהילתנו הק׳
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-[4/5] animate-pulse rounded-2xl bg-muted"
                    />
                  ))}
                </div>
              </div>
            }
          >
            <MissionEndorsementsCarousel />
          </Suspense>
        </div>
      </section>

      {/* ── 3. STATS ── */}
      <WebStats />

      {/* ── 4. HOW IT WORKS ── */}
      <section className="bg-secondary">
        <div className="shell-site py-20 md:py-24">
          <div className="mb-14 grid grid-cols-1 items-end gap-8 md:mb-16 md:grid-cols-[1.4fr_1fr] md:gap-16 lg:gap-20">
            <div>
              <p className="mb-4 text-body-sm font-bold tracking-[0.16em] text-primary">
                — איך זה עובד
              </p>
              <h2 className="text-display leading-[1.05] font-bold tracking-[-0.02em] text-foreground">
                איך עובדת מערכת
                <br />
                <HighlightSpan>קול מצהלות?</HighlightSpan>
              </h2>
            </div>
            <p className="text-subtitle text-foreground/80 md:pb-1">
              בשילוב מושלם של טכנולוגיה, מידע, שיתוף ובברכת רבני קהילתינו הק׳.
            </p>
          </div>

          <div className="border-t border-border">
            {steps.map(({ num, title, desc }) => (
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

          {/* <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3 md:mt-16 md:gap-5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-background bg-primary-stripe-sm"
                aria-hidden="true"
              />
            ))}
          </div> */}
        </div>
      </section>

      {/* ── 5. WHO IS IT FOR ── */}
      <section className="bg-background">
        <div className="shell-site py-20 md:py-24">
          <div className="mb-14 text-center md:mb-16">
            <h2 className="mb-4 text-display leading-[1.08] font-bold text-primary">
              למי המערכת
              <br />
              <HighlightSpan>מתאימה?</HighlightSpan>
            </h2>
            <p className="mx-auto max-w-3xl text-subtitle text-foreground/80">
              לכל העוסקים בתחום כמקצוע, כשליחות, או עבור עצמם, ילדיהם ותלמידיהם.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {audiences.map(({ title, desc, features, cta, href }) => (
              <article
                key={title}
                className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 md:p-9"
              >
                <h3 className="text-title font-bold text-primary">{title}</h3>
                <p className="text-body text-foreground/80">
                  {desc}
                </p>
                <ul className="flex flex-col gap-4">
                  {features.map(({ title: ft, desc: fd }) => (
                    <li key={ft} className="flex items-start gap-3">
                      <CheckSvg />
                      <span className="text-body leading-snug">
                        <b className="text-foreground">{ft}</b>
                        <br />
                        <span className="text-muted-foreground">{fd}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Button asChild size="lg" className="mt-auto w-full">
                  <Link href={href}>{cta}</Link>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PRINCIPLES ── */}
      <section className="bg-secondary">
        <div className="shell-site py-20 md:py-24">
          <div className="mb-14 grid grid-cols-1 items-end gap-8 md:mb-16 md:grid-cols-[1fr_auto] md:gap-10">
            <div>
              <h2 className="mb-5 text-display leading-[1.08] font-bold tracking-[-0.01em] text-foreground">
                העקרונות של
                <br />
                <HighlightSpan>קול מצהלות</HighlightSpan>
              </h2>
              <p className="max-w-2xl text-body text-foreground/80">
                הכללים שלנו נוסחו מתוך הבנת האחריות העצומה והרגישות הנדרשת
                בתחום.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href={"/auth/sign-up" as any}>
                הצטרפו עכשיו <ArrowSmall />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-16">
            {principles.map(({ Icon, title, desc }) => (
              <article
                key={title}
                className="relative flex flex-col items-center text-center"
              >
                <Icon className="relative mb-5 size-14 text-primary" />
                <h3 className="relative mb-4 text-subtitle leading-snug font-bold text-primary">
                  {title}
                </h3>
                <p className="relative text-body text-foreground/80">
                  {desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. SCREENSHOTS ── */}
      <section className="bg-background">
        <div className="shell-site py-20 md:py-24">
          <div className="mb-14 text-center md:mb-16">
            <h2 className="mb-5 text-display leading-[1.08] font-bold text-primary text-balance">
              איך זה נראה
              <br />
              <HighlightSpan>מבפנים?</HighlightSpan>
            </h2>
            <p className="mx-auto max-w-3xl text-subtitle text-foreground/80">
              מה בדיוק עושים? מה האפשרויות שם? כנסו לראות!
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 lg:gap-x-10">
            <div className="order-1 h-full min-h-0">
              <ParentsProductPreview />
            </div>
            <div className="order-3 h-full min-h-0 md:order-2">
              <ShadchanimProductPreview />
            </div>
            <div className="order-2 flex flex-col items-start gap-4 md:order-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-subtitle leading-snug font-bold text-foreground">
                מערכת קול מצהלות להורים ולמיועדים
              </h3>
              <Button asChild size="lg" variant="outline">
                <Link href={"/parents" as any}>
                  כנסו לראות <ArrowSmall />
                </Link>
              </Button>
            </div>
            <div className="order-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-subtitle leading-snug font-bold text-foreground">
                מערכת קול מצהלות לשדכנים
              </h3>
              <Button asChild size="lg" variant="outline">
                <Link href={"/shadchanim" as any}>
                  כנסו לראות <ArrowSmall />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. RECENT ENGAGEMENTS — hidden when no data ── */}
      <Suspense>
        <HomepageEngagements />
      </Suspense>

      {/* ── 9. KNOWLEDGE PREVIEW — hidden when no data ── */}
      <Suspense>
        <HomepageKnowledge />
      </Suspense>

      {/* ── FINAL CTA ── */}
      <WebCta />
    </>
  );
}
