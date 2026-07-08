import Link from "next/link";
import { Suspense } from "react";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";
import { WebCta } from "@/components/website/cta";

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

const stories = [
  {
    title: "בזכות שיחות עם הורים דואגים",
    desc: "שלא מקבלים הצעות רלוונטיות, שמרגישים שהשדכנים לא מכירים את הבן או הבת שלהם, שהצעות טובות נתקעות להם פשוט בגלל תקשורת לקויה וחוסר הבנה מול השדכנים.",
  },
  {
    title: "בזכות בקשות של עלטערע בחורים ומיועדי פרק ב' כאובים",
    desc: 'שהולכים ומתבגרים, כמעט ולא מקבלים הצעות למרות היותם מצוינים ואיכותיים, אך רוב השדכנים מעדיפים להתעסק עם השידוכים הקלים בלבד והם כבר מתחילים לאבד את התקווה.',
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
      {/* ── 1. OPENING STORY ── */}
      <section className="bg-[#ecf0f2]">
        <div className="mx-auto px-6" style={{ maxWidth: 1120, paddingTop: 72, paddingBottom: 72 }}>
          <h1
            className="text-center font-bold text-[#2b5a5c]"
            style={{ fontSize: "clamp(32px,4vw,46px)", marginBottom: 48, lineHeight: 1.1 }}
          >
            קול מצהלות הוקמה<br /><HighlightSpan>בזכותכם</HighlightSpan>
          </h1>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {stories.map(({ title, desc }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-[14px] border border-[#d9dee0] bg-white p-[30px]"
                style={{ boxShadow: "0 4px 14px -8px rgba(20,40,40,.12)" }}
              >
                <h3 className="text-[18px] font-bold text-[#2b5a5c]" style={{ margin: 0, lineHeight: 1.3 }}>{title}</h3>
                <p className="text-[15px] leading-[1.7] text-[#5c6a68]" style={{ margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. SUMMARY ── */}
      <section className="bg-[#e3e9eb]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2
            className="text-center font-bold text-[#2b5a5c]"
            style={{ fontSize: "clamp(26px,3vw,34px)", marginBottom: 24, lineHeight: 1.2 }}
          >
            בזכותכם, יצאנו לדרך.
          </h2>
          <p className="mb-4 text-[16.5px] leading-[1.75] text-[#5c6a68]">
            לא מתוך מחשבה להמציא מחדש את עולם השידוכים, המתנהל בדרך אבותינו הק' מזה דורי דורות, אלא במטרה לשמור על הקיים ולהכניס לתוכו כלי עזר וסיוע הנצרך בעקבות המצב, לבנות מערכת טכנולוגית שתקל על ההורים, על המיועדים ובעיקר על השדכנים, מבלי לפגום במעמד הקדוש של הקמת בית בישראל.
          </p>
          <p className="text-[16.5px] leading-[1.75] text-[#5c6a68]">
            וכך, בברכת הקודש של כ"ק מרן אדמו"ר שליט"א ובהכוונתם של רבני קהילתנו הק' ובראשם הגה"צ ר' שמאי גרוס שליט"א והגה"צ ר' שמואל יעקב לנדאו שליט"א, עם תכנון ומחשבה על כל פרט ופרט, ועם צוות מסור של אנשי מעשה מומחים ויראי שמיים – נרתמנו למלאכה.
          </p>
          <p className="mt-6 text-center text-[17px] font-bold text-[#2b5a5c]">
            מערכת קול מצהלות — הפתרון המושלם לנושא השידוכים בקהילתנו הק'.
          </p>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS (ProcessRows) ── */}
      <section className="bg-[#e3e9eb]">
        <div className="mx-auto px-6" style={{ maxWidth: 1160, paddingTop: 80, paddingBottom: 80 }}>
          <div className="mb-[52px] text-center">
            <h2
              className="font-bold text-[#1b2523]"
              style={{ fontSize: "clamp(28px,3.4vw,40px)", lineHeight: 1.1, margin: 0 }}
            >
              כך עובדת<br />
              <span className="text-[#2b5a5c]">המערכת</span>
            </h2>
          </div>
          <div className="border-t border-[#c8d1d0]">
            {processSteps.map(({ num, title, desc }) => (
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
        </div>
      </section>

      <WebStats />
      <Suspense><RabbinicalEndorsements /></Suspense>
      <WebCta />
    </>
  );
}
