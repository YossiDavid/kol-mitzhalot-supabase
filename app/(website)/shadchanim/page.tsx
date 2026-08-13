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

export default function ShadchanPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto px-6 py-24 text-center" style={{ maxWidth: 1120 }}>
          <h1
            className="font-bold text-primary-foreground text-display" style={{marginBottom: 20, lineHeight: 1.1}}
          >
            שדכנים ושדכניות
          </h1>
          <p className="mx-auto mb-10 text-subtitle leading-[1.65] opacity-90" style={{ maxWidth: 640 }}>
            מערכת קול מצהלות תוכננה ונבנתה במיוחד עבורכם, והיא כאן כדי לפתור את כל האתגרים שאתם מתמודדים איתם בהצעת וניהול שידוכים.
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
