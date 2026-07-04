import Section from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";
import Link from "next/link";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    q: "לא מקבלים מספיק הצעות משדכנים?",
    a: 'אולי הם לא מכירים אתכם מספיק! מלאו עכשיו כרטיס קו"ח בקול מצהלות, הרחיבו ככל האפשר בפרטים האישיים, המשפחתיים והתעסוקתיים ועזרו לעשרות השדכנים במערכת להכיר אתכם טוב יותר ולהציע הצעות מתאימות יותר!',
  },
  {
    q: "הפרטיות חשובה לכם? גם לנו!",
    a: 'אין יותר קבצי קו"ח ותמונות שמסתובבות אצל מי יודע מי! כרטיסי הקו"ח בקול מצהלות חשופים לשדכנים מקצועיים בלבד שזוהו ואושרו על ידי המערכת, רק אתם מחליטים ומאשרים למי ומתי להראות את התמונות שלכם, והמידע שלכם נשאר תמיד בידיים שלכם וניתן לשינויים ועריכות מתי שתרצו!',
  },
  {
    q: "מגיבים בקלות על כל הצעה שמקבלים!",
    a: "כבר לא צריך להתקשר באי נעימות בשביל לדחות הצעה! מגיבים לשדכן על ההצעה ישירות מתוך המערכת, בוחרים אם מעוניינים להתקדם, לברר או להוריד, מפרטים אם רוצים להוסיף משהו נוסף ומתנהלים מול השדכן בקלות ובנוחות!",
  },
  {
    q: "רוצים לקבל יותר הצעות?",
    a: 'שדרגו למנוי פרימיום בקול מצהלות! כרטיס הקו"ח שלכם יבלוט מעל שאר השמות שמופיעים לשדכנים ברשימה, תוכלו לציין סכום דמי שדכנות גבוה יותר שימשוך שדכנים נוספים להציע לכם ותקבלו יותר הצעות שיובילו לסגירת השידוך המתאים בקלות ובמהירות בעז"ה!',
  },
];

export default function ParentsPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <Section
        className="bg-primary text-primary-foreground"
        containerClassName="py-20 md:py-28 text-center space-y-6"
      >
        <h1 className="text-primary-foreground">הורים ומיועדים</h1>
        <p className="text-xl opacity-90">קול מצהלות כאן לעזרתכם!</p>
        <p className="mx-auto max-w-2xl opacity-80">
          מערכת קול מצהלות תוכננה ונבנתה במיוחד על מנת לסייע לשדכנים להציע לכם יותר הצעות
          מתאימות, כך שתוכלו למצוא את הבאשערטע בקלות ובמהירות רבה בעז"ה!
        </p>
        <Button asChild size="lg" variant="secondary">
          <Link href="/auth/sign-up">הירשמו עכשיו</Link>
        </Button>
      </Section>

      {/* Problem-Solution sections */}
      {FEATURES.map((f, i) => (
        <Section
          key={i}
          className={cn(i % 2 === 1 && "bg-muted/40")}
          containerClassName="py-16 md:py-20"
        >
          <div
            className={cn(
              "grid items-center gap-10 md:grid-cols-2",
              i % 2 === 1 && "md:[direction:rtl]",
            )}
          >
            <div className="aspect-video rounded-2xl bg-muted" />
            <div className={cn("space-y-4", i % 2 === 1 && "[direction:rtl]")}>
              <h2 className="text-2xl">{f.q}</h2>
              <p className="leading-relaxed text-muted-foreground">{f.a}</p>
            </div>
          </div>
        </Section>
      ))}

      <WebStats />
      <RabbinicalEndorsements />

      <Section className="bg-primary text-primary-foreground" containerClassName="py-12 text-center">
        <Button asChild size="lg" variant="secondary">
          <Link href="/auth/sign-up">הירשמו עכשיו</Link>
        </Button>
      </Section>
    </div>
  );
}
