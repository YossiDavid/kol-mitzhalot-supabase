import Section from "@/components/layout/section";
import Box from "@/components/layout/box";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";
import { WebCta } from "@/components/website/cta";
import { Heart, Users, BookOpen, Crown } from "lucide-react";

const stories = [
  {
    icon: Heart,
    title: "בזכות שיחות עם הורים דואגים",
    desc: "שלא מקבלים הצעות רלוונטיות, שמרגישים שהשדכנים לא מכירים את הבן או הבת שלהם, שהצעות טובות נתקעות להם פשוט בגלל תקשורת לקויה וחוסר הבנה מול השדכנים.",
  },
  {
    icon: Users,
    title: "בזכות בקשות של עלטערע בחורים ומיועדי פרק ב' כאובים",
    desc: 'שהולכים ומתבגרים, כמעט ולא מקבלים הצעות למרות היותם מצוינים ואיכותיים, אך רוב השדכנים מעדיפים להתעסק עם השידוכים הקלים בלבד והם כבר מתחילים לאבד את התקווה.',
  },
  {
    icon: Crown,
    title: "בזכות דיונים עם שדכנים מותשים",
    desc: "שמתמודדים עם מקצוע שוחק ולא מתגמל, עומס אדיר של מידע שקשה לזכור, הורים שלא מגיבים להצעות, קושי לברר על מיועדים ואתגר אדיר בניהול תהליך מורכב מול 2 הצדדים.",
  },
  {
    icon: BookOpen,
    title: "ובזכות התייעצויות עם רבנים, דיינים וצוותי חינוך",
    desc: "שרואים את המצב הקשה ההולך ומחמיר בקהילתנו הק' וביקשו למצוא פתרון יסודי ויצירתי לבעיה, שיסייע הן להורים, הן למיועדים והן לשדכנים, בהקמת בתים נאמנים בישראל.",
  },
];

const howItWorks = [
  {
    title: "הורים או מיועדים בוגרים",
    desc: 'ממלאים כרטיס קו"ח מפורט שעולה למערכת ומוצג לשדכנים מורשים בלבד, מקבלים הצעות ומגיבים עליהם בקלות, וכך מסייעים לשדכנים להציע הצעות רבות יותר ומתאימות יותר.',
  },
  {
    title: "רבנים, דיינים וצוותי החינוך במוסדות",
    desc: 'כותבים על כרטיסי הקו"ח א גוט ווארט ומחמאות מהכירותם האישית עם המיועדים, ובכך מסייעים לשדכנים להכיר אותם טוב יותר.',
  },
  {
    title: "השדכנים והשדכניות במערכת",
    desc: "מקבלים את כל המידע בצורה מסודרת, צופים ומכירים לעומק את המיועדים, יוצרים הצעות שידוכים, שולחים אותן לצדדים ישירות מתוך המערכת ומקבלים תגובות מהירות, ויכולים להתייעץ ולדון זה עם זה בפורום סגור לשדכנים בלבד.",
  },
  {
    title: "השידוכים עצמם",
    desc: 'מתקדמים ומתנהלים בצורה יעילה, מהירה וקלה יותר לכל הצדדים, בתקשורת נוחה תוך שמירה על פרטיות וצניעות עד למציאת הבאשערטע וסגירת השידוך למזל טוב בעז"ה.',
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      {/* Opening story */}
      <Section containerClassName="py-16 md:py-24">
        <div className="space-y-10">
          <div className="space-y-2 text-center">
            <h1>קול מצהלות הוקמה בזכותכם</h1>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {stories.map((s) => {
              const Icon = s.icon;
              return (
                <Box key={s.title} className="flex flex-col gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </Box>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Summary */}
      <Section className="bg-muted/40" containerClassName="py-16 md:py-24">
        <div className="mx-auto max-w-3xl space-y-6">
          <h2 className="text-center">בזכותכם, יצאנו לדרך.</h2>
          <p className="leading-relaxed text-muted-foreground">
            לא מתוך מחשבה להמציא מחדש את עולם השידוכים, המתנהל בדרך אבותינו הק' מזה דורי דורות,
            אלא במטרה לשמור על הקיים ולהכניס לתוכו כלי עזר וסיוע הנצרך בעקבות המצב, לבנות מערכת
            טכנולוגית שתקל על ההורים, על המיועדים ובעיקר על השדכנים, מבלי לפגום במעמד הקדוש של
            הקמת בית בישראל.
          </p>
          <p className="leading-relaxed text-muted-foreground">
            וכך, בברכת הקודש של כ"ק מרן אדמו"ר שליט"א ובהכוונתם של רבני קהילתנו הק' ובראשם
            הגה"צ ר' שמאי גרוס שליט"א והגה"צ ר' שמואל יעקב לנדאו שליט"א, עם תכנון ומחשבה על כל
            פרט ופרט, ועם צוות מסור של אנשי מעשה מומחים ויראי שמיים – נרתמנו למלאכה.
          </p>
          <p className="text-center font-bold text-primary">
            מערכת קול מצהלות — הפתרון המושלם לנושא השידוכים בקהילתנו הק'.
          </p>
        </div>
      </Section>

      {/* How it works */}
      <Section containerClassName="py-16 md:py-24">
        <div className="space-y-10">
          <h2 className="text-center">כך עובדת המערכת</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step, i) => (
              <Box key={i} className="flex flex-col gap-3 p-6 text-center">
                <span className="text-5xl font-black leading-none text-primary/20">{i + 1}</span>
                <h3 className="text-sm font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </Box>
            ))}
          </div>
        </div>
      </Section>

      <WebStats />
      <RabbinicalEndorsements />
      <WebCta />
    </div>
  );
}
