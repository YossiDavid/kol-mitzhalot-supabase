import Link from "next/link";
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

const SECTION_BG = ["bg-[#ecf0f2]", "bg-[#e3e9eb]"];

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function ImagePlaceholder() {
  return (
    <div
      className="rounded-2xl border border-dashed border-[#c3ccce] bg-white"
      style={{
        aspectRatio: "16/9",
        backgroundImage: "repeating-linear-gradient(135deg,transparent 0 13px,rgba(43,90,92,.06) 13px 26px)",
      }}
    />
  );
}

export default function ParentsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#2b5a5c] text-[#f4f8f7]">
        <div className="mx-auto px-6 py-24 text-center" style={{ maxWidth: 1120 }}>
          <h1
            className="font-bold text-[#f4f8f7]"
            style={{ fontSize: "clamp(32px,4.5vw,52px)", marginBottom: 20, lineHeight: 1.1 }}
          >
            הורים ומיועדים
          </h1>
          <p className="mx-auto mb-10 text-[18px] leading-[1.65] opacity-90" style={{ maxWidth: 640 }}>
            מערכת קול מצהלות תוכננה ונבנתה במיוחד על מנת לסייע לשדכנים להציע לכם יותר הצעות מתאימות, כך שתוכלו למצוא את הבאשערטע בקלות ובמהירות רבה בעז"ה!
          </p>
          <Link
            href={"/auth/sign-up" as any}
            className="inline-flex items-center gap-[9px] rounded-full no-underline transition-transform hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(145deg,#f2dc8f,#dcb149)",
              color: "#123331",
              padding: "16px 34px",
              fontSize: 17,
              fontWeight: 800,
              boxShadow: "0 20px 40px -16px rgba(0,0,0,.55)",
            }}
          >
            הירשמו עכשיו ללא עלות <ArrowIcon />
          </Link>
        </div>
      </section>

      {/* Feature sections — alternating layout */}
      {FEATURES.map((f, i) => (
        <section key={i} className={SECTION_BG[i % 2]}>
          <div
            className="mx-auto grid grid-cols-2 items-center gap-12 px-6"
            style={{ maxWidth: 1120, paddingTop: 70, paddingBottom: 70 }}
          >
            {i % 2 === 0 ? (
              <>
                <div>
                  {f.premium && (
                    <span
                      className="mb-3 inline-block rounded-full px-3 py-1.5 text-[14px] font-semibold"
                      style={{ background: "rgba(207,154,60,.14)", color: "#a9772a" }}
                    >
                      פרימיום
                    </span>
                  )}
                  <h2
                    className="font-bold text-[#2b5a5c]"
                    style={{ fontSize: "clamp(22px,2.6vw,28px)", marginBottom: 16, lineHeight: 1.3 }}
                  >
                    {f.q}
                  </h2>
                  <p className="text-[16.5px] leading-[1.75] text-[#5c6a68]">{f.a}</p>
                </div>
                <ImagePlaceholder />
              </>
            ) : (
              <>
                <ImagePlaceholder />
                <div>
                  {f.premium && (
                    <span
                      className="mb-3 inline-block rounded-full px-3 py-1.5 text-[14px] font-semibold"
                      style={{ background: "rgba(207,154,60,.14)", color: "#a9772a" }}
                    >
                      פרימיום
                    </span>
                  )}
                  <h2
                    className="font-bold text-[#2b5a5c]"
                    style={{ fontSize: "clamp(22px,2.6vw,28px)", marginBottom: 16, lineHeight: 1.3 }}
                  >
                    {f.q}
                  </h2>
                  <p className="text-[16.5px] leading-[1.75] text-[#5c6a68]">{f.a}</p>
                </div>
              </>
            )}
          </div>
        </section>
      ))}

      <WebStats />
      <RabbinicalEndorsements />

      {/* Bottom CTA */}
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6 py-16 text-center" style={{ maxWidth: 1120 }}>
          <Link
            href={"/auth/sign-up" as any}
            className="inline-flex items-center gap-[9px] rounded-full no-underline transition-transform hover:-translate-y-0.5"
            style={{
              background: "#2b5a5c",
              color: "#f4f8f7",
              padding: "16px 34px",
              fontSize: 17,
              fontWeight: 800,
              boxShadow: "0 10px 24px -10px rgba(43,90,92,.6)",
            }}
          >
            הירשמו עכשיו ללא עלות <ArrowIcon />
          </Link>
        </div>
      </section>
    </>
  );
}
