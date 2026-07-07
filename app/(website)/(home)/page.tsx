import Link from "next/link";
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
      style={{ background: "#2b5a5c", color: "#f4f8f7", padding: "1px 14px 4px", transform: "rotate(-1.5deg)" }}
    >
      {children}
    </span>
  );
}

function CheckSvg({ size = 18, stroke = "#2b5a5c", strokeWidth = "2.5" }: { size?: number; stroke?: string; strokeWidth?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
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
  { num: "01", title: "הורים או מיועדים בוגרים", desc: 'ממלאים כרטיס קו"ח מפורט שעולה למערכת ומוצג לשדכנים מורשים בלבד.' },
  { num: "02", title: "רבנים, משפיעים וצוות מוסדות החינוך", desc: "כותבים על הכרטיס א גוט ווארט ומחמאות, מהכירותם האישית עם המיועדים." },
  { num: "03", title: "השדכנים והשדכניות במערכת", desc: "צופים ומכירים לעומק את המיועדים, יוצרים הצעות שידוכים ושולחים אותן ישירות מהמערכת." },
  { num: "04", title: "שני הצדדים שקיבלו את ההצעה", desc: "מגיבים ישירות לשדכנים במקום ובזמן שנוח, ומקדמים את השידוך המתאים בקלות." },
];

const audiences = [
  {
    title: "הורים ומיועדים",
    desc: 'שדכנים לא מתקשרים להציע? רוצים שעוד שדכנים מקצועיים יכירו אתכם? מערכת קול מצהלות עוזרת לשדכנים להכיר אתכם ולהציע לכם הצעות שמתאימות בדיוק לכם! מלאו עכשיו כרטיסי קו"ח מלאים ומפורטים, קבלו הצעות מדויקות משדכנים ובעז"ה תמצאו את הזיווג בקרוב ממש!',
    features: [
      { title: "פרטיות מובטחת!", desc: "רק שדכנים מורשים חשופים למידע שלכם" },
      { title: "שיח פתוח ומהיר!", desc: "מתכתבים עם השדכן ישירות מתוך המערכת" },
      { title: "קידום VIP!", desc: 'מצטרפים למנוי פרימיום ונהנים מקידום הקו"ח לכל השדכנים' },
    ],
    cta: "לקול מצהלות להורים ומיועדים",
    href: "/parents" as any,
  },
  {
    title: "שדכנים ושדכניות",
    desc: 'שורפים שעות על בירורים בסיסיים? הולכים לאיבוד בתוך ים הניירת? הצטרפו לקול מצהלות ותהנו ממאגר מידע עדכני עם קו"ח מפורטים של כלל המיועדים בבעלזא, אפשרויות חיפוש ומיון מתקדמות, שמירת שמות מועדפים, שליחת הצעות וניהול השידוכים ישירות מתוך המערכת!',
    features: [
      { title: "מאגר מתעדכן!", desc: "עם אפשרויות חיפוש, סינון, מיון, שיתוף וייעוץ מהיר" },
      { title: "ניהול שידוכים!", desc: "יוצרים הצעות שידוך, שולחים לצדדים ומקבלים משוב בקלות" },
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
      { title: "חיסכון בזמן!", desc: "במקום לענות לכל המבררים כותבים פעם אחת וזהו" },
      { title: "חסד אמיתי!", desc: "המחמאה שלכם יכולה לגרום לשידוך להגיע" },
    ],
    cta: "להרשמה מהירה ללא עלות",
    href: "/auth/sign-up" as any,
  },
];

const principles = [
  {
    bg: "#d6e6e4",
    svgColor: "rgba(43,90,92,.06)",
    h3Color: "#173e3d",
    pColor: "#3f5250",
    title: 'הכוונה וליווי מקיף של רבני הארגון שליט"א',
    desc: 'הארגון הוקם על ידי שדכנים ועסקנים יר"ש, ומתנהל בליווי והכוונה שוטפים של הגה"צ ר׳ שמאי גרוס והגה"צ ר׳ שמואל יעקב לנדאו.',
  },
  {
    bg: "#f0e6cd",
    svgColor: "rgba(160,120,40,.09)",
    h3Color: "#4a3c17",
    pColor: "#5c5030",
    title: "פרטיות ואבטחת מידע ללא פשרות",
    desc: "אנו מתייחסים במלוא הרצינות לפרטיות שלכם! המערכת משתמשת בתקני אבטחה מתקדמים במיוחד, וההנהלה בודקת לעומק כל שדכן לפני מתן גישה למידע.",
  },
  {
    bg: "#e2e9e8",
    svgColor: "rgba(43,90,92,.05)",
    h3Color: "#1b2523",
    pColor: "#4a5654",
    title: 'התנהלות ערכית וללא חשש לשה"ר',
    desc: "המערכת בנויה ברוח התורה והחסידות: אין אפשרות לכתוב מידע שלילי, כל תגובה נבדקת לפני פרסומה ותמונות נשלחות תוך שמירה מוקפדת על פרטיות וצניעות.",
  },
];

function ArticleCard({ cat, date, read, title, excerpt }: { cat: string; date: string; read: string; title: string; excerpt: string }) {
  return (
    <Link
      href={"/knowledge" as any}
      className="flex flex-col overflow-hidden rounded-2xl border border-[#d9dee0] bg-white no-underline shadow-[0_1px_3px_rgba(20,40,40,.06)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(20,40,40,.28)]"
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          aspectRatio: "16/10",
          background: "#e8eeed",
          backgroundImage: "repeating-linear-gradient(135deg,transparent 0 13px,rgba(43,90,92,.06) 13px 26px)",
          color: "#9fb0ad",
          fontFamily: "ui-monospace,Menlo,monospace",
          fontSize: 11.5,
        }}
      >
        [ תמונת נושא ]
        <span className="absolute right-[14px] top-[14px] rounded-full bg-[rgba(255,255,255,.94)] px-3 py-[5px] text-[12px] font-bold text-[#2b5a5c] shadow-[0_2px_6px_rgba(20,40,40,.12)]">
          {cat}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-[10px] p-[22px_24px]">
        <div className="flex items-center gap-2 text-[12.5px] text-[#8a9694]">
          <span>{date}</span>
          <span className="h-[3px] w-[3px] rounded-full bg-[#c3ccce]" />
          <span>{read}</span>
        </div>
        <h3 className="text-[19px] font-bold leading-[1.35] text-[#1b2523]" style={{ margin: 0 }}>{title}</h3>
        <p className="text-[14px] leading-[1.6] text-[#66716f]" style={{ margin: 0 }}>{excerpt}</p>
        <div className="mt-auto flex items-center justify-between border-t border-[#eef2f2] pt-4">
          <div className="flex items-center gap-[9px]">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[rgba(43,90,92,.12)]">
              <LogoSvg size={15} className="text-[#2b5a5c]" />
            </span>
            <span className="text-[12.5px] font-semibold text-[#66716f]">מערכת קול מצהלות</span>
          </div>
          <span className="inline-flex items-center gap-[5px] text-[13.5px] font-bold text-[#2b5a5c]">
            לקריאה{" "}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const [{ data: articles }, { data: engagements }, { data: endorsementCheck }] = await Promise.all([
    supabase
      .from("articles")
      .select("id, slug, title, excerpt, category, read_time_minutes, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(3),
    supabase
      .from("engagements")
      .select("id, groom_name, bride_name, groom_city, bride_city, shadchan_name")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("endorsements").select("id").eq("is_published", true).limit(1),
  ]);
  const hasEndorsements = !!endorsementCheck?.length;

  return (
    <>
      {/* ── 1. HERO ── */}
      <section className="relative overflow-hidden bg-[#2b5a5c] text-[#f4f8f7]">
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
            className="absolute hidden flex-col items-center justify-center gap-1 rounded-full border-[3px] border-white text-center text-[14px] font-extrabold text-[#123331] no-underline transition-transform hover:scale-[1.06] md:flex"
            style={{
              top: 24,
              left: 24,
              width: 118,
              height: 118,
              background: "radial-gradient(circle at 33% 27%,#f4dd93,#d8ac44)",
              boxShadow: "0 4px 0 rgba(20,50,48,.18),0 22px 36px -14px rgba(0,0,0,.6)",
              transform: "rotate(-8deg)",
              zIndex: 4,
            }}
          >
            <span style={{ lineHeight: 1.18 }}>יש לי<br />רעיון<br />לשידוך</span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </Link>

          {/* Text column */}
          <div>
            <p className="mb-[18px] max-w-[540px] leading-[1.6] opacity-80" style={{ fontSize: "clamp(16px,1.6vw,18px)", fontWeight: 500 }}>
              שדכנים, הורים, אנשי ונשות חינוך, מחפשי שידוך בוגרים או בזיווג שני, וכל מי שיש לו רעיון לשידוך ורוצה לסייע להקים עוד בית נאמן בישראל:
            </p>
            <p className="mb-1 font-medium opacity-90" style={{ fontSize: "clamp(19px,2.4vw,26px)" }}>ברוכים הבאים ל</p>
            <h1
              className="font-bold leading-none tracking-[-0.02em] text-[#f4f8f7]"
              style={{ fontSize: "clamp(52px,8vw,80px)", marginBottom: 12 }}
            >
              קול מצהלות
            </h1>
            <p className="font-bold opacity-[.92]" style={{ fontSize: "clamp(20px,2.4vw,26px)", marginBottom: 32 }}>
              הארגון לקידום שידוכים בבעלזא
            </p>

            {/* Animated ticker */}
            <div className="mb-[34px] flex max-w-[560px] items-center gap-[11px]">
              <CheckSvg size={22} stroke="currentColor" strokeWidth="2.4" />
              <div className="h-[44px] flex-1 overflow-hidden">
                <div
                  className="ticker-roller"
                  style={{ animation: "roll 16s cubic-bezier(.7,0,.3,1) infinite", willChange: "transform" }}
                >
                  {tickerItems.map((item, i) => (
                    <div
                      key={i}
                      className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold"
                      style={{ height: 44, lineHeight: "44px", fontSize: 18.5 }}
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
                className="rounded-full px-7 py-[14px] text-[16px] font-bold text-[#234a4b] no-underline transition-colors hover:bg-white"
                style={{ background: "#f4f8f7", boxShadow: "0 10px 26px -12px rgba(0,0,0,.5)" }}
              >
                הירשמו עכשיו ללא עלות
              </Link>
              <Link
                href={"/contact" as any}
                className="rounded-full border border-[rgba(255,255,255,.42)] bg-transparent px-7 py-[14px] text-[16px] font-bold text-[#f4f8f7] no-underline transition-colors hover:bg-[rgba(255,255,255,.1)]"
              >
                דברו איתנו
              </Link>
            </div>
          </div>

          {/* Visual column */}
          <div className="relative">
            <div
              className="overflow-hidden rounded-[18px] bg-white"
              style={{
                boxShadow: "0 34px 80px -34px rgba(0,0,0,.6)",
                border: "1px solid rgba(255,255,255,.16)",
                transform: "rotate(-1.2deg)",
              }}
            >
              {/* Browser chrome */}
              <div className="flex gap-[6px] border-b border-[#e6eded] bg-[#f1f5f5] px-4 py-[13px]">
                {[1, 2, 3].map((d) => (
                  <span key={d} className="h-[9px] w-[9px] rounded-full bg-[#d3dcdc]" />
                ))}
              </div>
              <div className="p-4">
                <div
                  className="flex items-center justify-center rounded-[10px] border border-[#e6eded] text-center text-[12.5px] text-[#7c8b89]"
                  style={{
                    aspectRatio: "4/3",
                    fontFamily: "ui-monospace,Menlo,monospace",
                    padding: 18,
                    backgroundImage: "repeating-linear-gradient(135deg,transparent 0 12px,rgba(43,90,92,.06) 12px 24px)",
                  }}
                >
                  [ צילום מסך · ממשק<br />ניהול השידוכים ]
                </div>
              </div>
            </div>

            {/* Floating toast — hidden on mobile */}
            <div
              className="absolute hidden items-center gap-[10px] rounded-[12px] bg-white md:flex"
              style={{
                bottom: -18,
                left: -16,
                border: "1px solid #e6eded",
                boxShadow: "0 18px 40px -18px rgba(0,0,0,.4)",
                padding: "12px 16px",
                transform: "rotate(2deg)",
              }}
            >
              <span
                className="flex items-center justify-center rounded-[9px]"
                style={{ width: 30, height: 30, background: "rgba(43,90,92,.1)" }}
              >
                <CheckSvg size={17} strokeWidth="2.6" />
              </span>
              <span className="text-right">
                <span className="block text-[13px] font-bold text-[#1b2523]">הצעה נשלחה</span>
                <span className="block text-[11.5px] text-[#889492]">ממתינה לתגובת הצדדים</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. MISSION ── */}
      <section className="bg-[#ecf0f2]">
        <div
          className={`mx-auto grid grid-cols-1 items-center gap-8 px-6 py-[76px] md:gap-14 ${hasEndorsements ? "md:grid-cols-[1.1fr_.9fr]" : ""}`}
          style={{ maxWidth: 1120 }}
        >
          <div>
            <h2
              className="font-bold text-[#2b5a5c]"
              style={{ fontSize: "clamp(28px,3.2vw,36px)", lineHeight: 1.1, marginBottom: 18 }}
            >
              המטרה<br /><HighlightSpan>שלנו ושלכם</HighlightSpan>
            </h2>
            <p className="mb-4 text-[16.5px] leading-[1.75] text-[#5c6a68]">
              לקדם שידוכים ולהקים בתים נאמנים בישראל. בסייעתא דשמיא, בברכת הקודש ובהכוונת רבנים חשובים בקהילתינו הק׳, הושקעו משאבים רבים בסיוע נדיבים על מנת להקים את מערכת קול מצהלות, מתוך תחושת שליחות, אחריות ורצון לקדם את ענייני השידוכים בקהילתנו.
            </p>
            <p className="mb-5 text-[16.5px] leading-[1.75] text-[#5c6a68]">
              המערכת נועדה לשמש ככתובת לכל נושא השידוכים בקהילתנו הק׳ וככלי עזר נוח להורים, שדכנים, רבנים ואנשי ונשות החינוך במוסדותינו ברחבי העולם, במטרה לסייע במציאת זיווג הגון בדרך קלה ונוחה, תוך שמירה על ערכי הקדושה וצנעת הפרט, ללא חשש לשה"ר ובליווי הלכתי ורוחני מלא.
            </p>
            <Link href={"/about" as any} className="inline-flex items-center gap-[6px] text-[16px] font-bold text-[#2b5a5c] no-underline">
              עוד על קול מצהלות <ArrowSmall />
            </Link>
          </div>

          {/* Endorsement slider — hidden when no endorsements */}
          {hasEndorsements && (
            <div className="relative">
              <p className="mb-3 text-center text-[13px] font-bold tracking-[.02em] text-[#2b5a5c]">
                הסכמות והמלצות רבני קהילתנו הק׳
              </p>
              <div className="relative">
                <div
                  className="flex items-center justify-center rounded-2xl border border-dashed border-[#c3ccce] bg-white text-center text-[13px] text-[#7c8b89]"
                  style={{
                    aspectRatio: "4/5",
                    fontFamily: "ui-monospace,Menlo,monospace",
                    padding: 22,
                    backgroundImage: "repeating-linear-gradient(135deg,transparent 0 12px,rgba(43,90,92,.05) 12px 24px)",
                    boxShadow: "0 1px 3px rgba(20,40,40,.06)",
                  }}
                >
                  [ תמונת הסכמת רב · סליידר ]
                </div>
                {/* Nav arrows */}
                {[{ side: "left", d: "m15 18-6-6 6-6" }, { side: "right", d: "m9 18 6-6-6-6" }].map(({ side, d }) => (
                  <button
                    key={side}
                    aria-label={side === "right" ? "הבא" : "הקודם"}
                    className="absolute top-1/2 flex h-[40px] w-[40px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-[#d9dee0] bg-white text-[#2b5a5c] shadow-[0_8px_18px_-8px_rgba(0,0,0,.35)] transition-colors hover:bg-[#f2f6f6]"
                    style={{ [side]: -16 }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d={d} />
                    </svg>
                  </button>
                ))}
              </div>
              {/* Dots */}
              <div className="mt-4 flex justify-center gap-[7px]">
                <span className="h-[7px] rounded-full bg-[#2b5a5c]" style={{ width: 22 }} />
                {[1, 2, 3].map((d) => <span key={d} className="h-[7px] w-[7px] rounded-full bg-[#c3ccce]" />)}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 3. STATS ── */}
      <WebStats />

      {/* ── 4. HOW IT WORKS ── */}
      <section className="bg-[#e3e9eb]">
        <div className="mx-auto px-6" style={{ maxWidth: 1160, paddingTop: 90, paddingBottom: 90 }}>
          {/* Section header */}
          <div className="mb-[52px] grid grid-cols-1 items-end gap-6 md:grid-cols-[1.35fr_1fr] md:gap-11">
            <div>
              <div className="mb-4 text-[13px] font-bold tracking-[.16em] text-[#2b5a5c]">— איך זה עובד</div>
              <h2
                className="font-bold text-[#1b2523]"
                style={{ fontSize: "clamp(34px,5vw,58px)", lineHeight: 1.02, letterSpacing: "-.02em", margin: 0 }}
              >
                איך עובדת מערכת<br />
                <span className="text-[#2b5a5c]">קול מצהלות?</span>
              </h2>
            </div>
            <p className="mb-[10px] text-[16px] leading-[1.7] text-[#5c6a68]" style={{ margin: 0 }}>
              בשילוב מושלם של טכנולוגיה, מידע, שיתוף ובברכת רבני קהילתינו הק׳.
            </p>
          </div>

          {/* Step rows */}
          <div className="border-t border-[#c8d1d0]">
            {steps.map(({ num, title, desc }) => (
              <div
                key={num}
                className="grid grid-cols-[64px_1fr] items-baseline border-b border-[#c8d1d0] gap-5 py-7 md:grid-cols-[96px_1fr] md:gap-7"
              >
                <div className="font-normal leading-none text-[#9fb2af]" style={{ fontSize: "clamp(38px,3.6vw,50px)" }}>
                  {num}
                </div>
                <div className="grid grid-cols-1 items-baseline gap-3 md:grid-cols-[minmax(200px,280px)_1fr] md:gap-7">
                  <h3 className="font-bold text-[#1b2523]" style={{ fontSize: "clamp(18px,1.9vw,22px)", margin: 0, lineHeight: 1.3 }}>
                    {title}
                  </h3>
                  <p className="text-[15px] leading-[1.65] text-[#5c6a68]" style={{ margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Photo strip */}
          <div className="mt-[52px] grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-[#dbe3e2]" style={{ aspectRatio: "4/3" }} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. WHO IS IT FOR ── */}
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6" style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}>
          <div className="mx-auto mb-12 max-w-[640px] text-center">
            <h2
              className="font-bold text-[#2b5a5c]"
              style={{ fontSize: "clamp(28px,3.2vw,36px)", lineHeight: 1.1, marginBottom: 12 }}
            >
              למי המערכת<br /><HighlightSpan>מתאימה?</HighlightSpan>
            </h2>
            <p className="text-[17px] text-[#5c6a68]" style={{ margin: 0 }}>לכל העוסקים בתחום כמקצוע, כשליחות, או עבור עצמם, ילדיהם ותלמידיהם.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {audiences.map(({ title, desc, features, cta, href }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-[14px] border border-[#d9dee0] bg-white p-[30px]"
                style={{ boxShadow: "0 4px 14px -8px rgba(20,40,40,.12)" }}
              >
                <h3 className="text-[22px] font-bold text-[#2b5a5c]" style={{ margin: 0 }}>{title}</h3>
                <p className="text-[14.5px] leading-[1.65] text-[#5c6a68]" style={{ margin: 0 }}>{desc}</p>
                <ul className="flex flex-col gap-3 list-none p-0 m-0">
                  {features.map(({ title: ft, desc: fd }) => (
                    <li key={ft} className="flex items-start gap-[9px]">
                      <CheckSvg />
                      <span className="text-[14.5px]">
                        <b className="text-[#1b2523]">{ft}</b><br />
                        <span className="text-[#5c6a68]">{fd}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className="mt-auto rounded-[10px] bg-[#2b5a5c] px-[18px] py-3 text-center text-[15px] font-bold text-[#f4f8f7] no-underline transition-colors hover:bg-[#234a4b]"
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PRINCIPLES ── */}
      <section className="bg-[#f3f6f5]">
        <div className="mx-auto px-6" style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}>
          <div className="mb-[52px] grid grid-cols-1 items-end gap-6 md:grid-cols-[1fr_auto] md:gap-8">
            <div style={{ maxWidth: 660 }}>
              <span className="mb-5 inline-block rounded-[8px] bg-[#e4ebe9] px-[14px] py-1.5 text-[12.5px] font-bold tracking-[.14em] text-[#2b5a5c]">
                עקרונות
              </span>
              <h2
                className="font-bold text-[#1b2523]"
                style={{ fontSize: "clamp(30px,4.2vw,52px)", lineHeight: 1.12, letterSpacing: "-.01em", marginBottom: 18, marginTop: 0 }}
              >
                העקרונות של<br />
                <span
                  className="inline-block rounded-[12px]"
                  style={{ background: "#2b5a5c", color: "#f4f8f7", padding: "1px 16px 5px", transform: "rotate(-1.5deg)" }}
                >
                  קול מצהלות
                </span>
              </h2>
              <p className="max-w-[520px] text-[16.5px] leading-[1.7] text-[#5c6a68]" style={{ margin: 0 }}>
                הכללים שלנו נוסחו מתוך הבנת האחריות העצומה והרגישות הנדרשת בתחום.
              </p>
            </div>
            <Link
              href={"/auth/sign-up" as any}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-[11px] bg-[#1b2523] px-[30px] py-[15px] text-[15px] font-bold text-[#f4f8f7] no-underline transition-colors hover:bg-[#2b5a5c]"
            >
              הצטרפו עכשיו <ArrowSmall />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-[22px] md:grid-cols-3">
            {principles.map(({ bg, svgColor, h3Color, pColor, title, desc }) => (
              <div
                key={title}
                className="relative flex flex-col items-center justify-center overflow-hidden rounded-[18px] p-[40px_30px] text-center"
                style={{ background: bg, minHeight: 236 }}
              >
                <LogoSvg
                  size={220}
                  className="pointer-events-none absolute"
                  style={{ color: svgColor, bottom: -60, left: -50 } as React.CSSProperties}
                />
                <h3 className="relative font-bold leading-[1.3]" style={{ fontSize: 21, margin: "0 0 14px", color: h3Color }}>{title}</h3>
                <p className="relative text-[14.5px] leading-[1.7]" style={{ color: pColor, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. SCREENSHOTS ── */}
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6" style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}>
          <div className="mx-auto mb-12 max-w-[640px] text-center">
            <h2
              className="font-bold text-[#2b5a5c]"
              style={{ fontSize: "clamp(28px,3.2vw,36px)", lineHeight: 1.1, marginBottom: 12 }}
            >
              איך זה נראה<br /><HighlightSpan>מבפנים?</HighlightSpan>
            </h2>
            <p className="text-[17px] text-[#5c6a68]" style={{ margin: 0 }}>מה בדיוק עושים? מה האפשרויות שם? כנסו לראות!</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              { title: "מערכת קול מצהלות להורים ולמיועדים", href: "/parents" as any },
              { title: "מערכת קול מצהלות לשדכנים", href: "/shadchanim" as any },
            ].map(({ title, href }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-[14px] border border-[#d9dee0] bg-white p-[22px]"
                style={{ boxShadow: "0 1px 3px rgba(20,40,40,.06)" }}
              >
                <div className="overflow-hidden rounded-[10px] border border-[#e2e8e8]">
                  <div className="flex gap-[6px] border-b border-[#e6eded] bg-[#f1f5f5] px-[14px] py-[10px]">
                    {[1, 2, 3].map((d) => <span key={d} className="h-[9px] w-[9px] rounded-full bg-[#d3dcdc]" />)}
                  </div>
                  <div
                    className="flex items-center justify-center text-center text-[12.5px] text-[#7c8b89]"
                    style={{
                      aspectRatio: "16/9",
                      fontFamily: "ui-monospace,Menlo,monospace",
                      padding: 16,
                      backgroundImage: "repeating-linear-gradient(135deg,transparent 0 11px,rgba(43,90,92,.05) 11px 22px)",
                    }}
                  >
                    [ צילום מסך ]
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-bold text-[#1b2523]" style={{ margin: 0 }}>{title}</p>
                  <Link
                    href={href}
                    className="inline-flex shrink-0 items-center gap-[5px] rounded-[8px] border border-[#cfd8d8] px-[14px] py-2 text-[13.5px] font-bold text-[#2b5a5c] no-underline transition-colors hover:bg-[#eef3f3]"
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
      <RabbinicalEndorsements />

      {/* ── 9. RECENT ENGAGEMENTS — hidden when no data ── */}
      {!!engagements?.length && (
        <section className="bg-[#ecf0f2]">
          <div className="mx-auto px-6" style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <h2
                className="font-bold text-[#2b5a5c]"
                style={{ fontSize: "clamp(28px,3.2vw,36px)", lineHeight: 1.1, margin: 0 }}
              >
                שידוכים שנסגרו<br /><HighlightSpan>למזל טוב</HighlightSpan>
              </h2>
              <div className="flex gap-[10px]">
                {[
                  { label: "לכל מה שחדש", href: "/whats-new" as any },
                  { label: "לעדכון מודעת מאורסים", href: "/contact" as any },
                ].map(({ label, href }) => (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-[8px] border border-[#cfd8d8] px-4 py-[9px] text-[14px] font-bold text-[#2b5a5c] no-underline transition-colors hover:bg-[#e3e9eb]"
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
                  className="flex flex-col items-center justify-center rounded-[14px] border border-[#d9dee0] bg-white p-4 text-center"
                  style={{ aspectRatio: "3/4" }}
                >
                  <div className="mb-1 text-[13px] font-bold text-[#1b2523]">{e.groom_name}</div>
                  <div className="mb-2 text-[11px] text-[#8a9694]">&</div>
                  <div className="text-[13px] font-bold text-[#1b2523]">{e.bride_name}</div>
                  {e.groom_city && (
                    <div className="mt-3 text-[11px] text-[#8a9694]">{e.groom_city}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 10. KNOWLEDGE PREVIEW — hidden when no data ── */}
      {!!articles?.length && (
        <section className="bg-[#e3e9eb]">
          <div className="mx-auto px-6" style={{ maxWidth: 1120, paddingTop: 80, paddingBottom: 80 }}>
            <div className="mx-auto mb-12 max-w-[640px] text-center">
              <h2
                className="font-bold text-[#2b5a5c]"
                style={{ fontSize: "clamp(28px,3.2vw,36px)", lineHeight: 1.1, marginBottom: 12 }}
              >
                מרכז הידע של<br /><HighlightSpan>קול מצהלות</HighlightSpan>
              </h2>
              <p className="text-[17px] text-[#5c6a68]" style={{ margin: 0 }}>
                כל מה שחשוב לדעת על שידוכים, בירורים, פגישות, אירוסין ומה שביניהם.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((a) => (
                <ArticleCard
                  key={a.id}
                  cat={CATEGORY_LABELS[a.category] ?? a.category}
                  date={a.published_at ? new Date(a.published_at).toLocaleDateString("he-IL") : ""}
                  read={`${a.read_time_minutes} דק׳ קריאה`}
                  title={a.title}
                  excerpt={a.excerpt}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FINAL CTA ── */}
      <div style={{ background: "linear-gradient(180deg,#e3e9eb 0%,#eef2f1 100%)" }}>
        <WebCta />
      </div>
    </>
  );
}
