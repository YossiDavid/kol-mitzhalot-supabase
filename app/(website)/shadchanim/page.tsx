import Link from "next/link";
import { Suspense } from "react";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";

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

export default function ShadchanPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[#2b5a5c] text-[#f4f8f7]">
        <div className="mx-auto px-6 py-24 text-center" style={{ maxWidth: 1120 }}>
          <h1
            className="font-bold text-[#f4f8f7]"
            style={{ fontSize: "clamp(32px,4.5vw,52px)", marginBottom: 20, lineHeight: 1.1 }}
          >
            שדכנים ושדכניות
          </h1>
          <p className="mx-auto mb-10 text-[18px] leading-[1.65] opacity-90" style={{ maxWidth: 640 }}>
            מערכת קול מצהלות תוכננה ונבנתה במיוחד עבורכם, והיא כאן כדי לפתור את כל האתגרים שאתם מתמודדים איתם בהצעת וניהול שידוכים.
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
            className="mx-auto grid grid-cols-1 items-center gap-8 px-6 md:grid-cols-2 md:gap-12"
            style={{ maxWidth: 1120, paddingTop: 70, paddingBottom: 70 }}
          >
            {i % 2 === 0 ? (
              <>
                <div>
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
      <Suspense><RabbinicalEndorsements /></Suspense>

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
