import Section from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { WebStats } from "@/components/website/stats";
import { RabbinicalEndorsements } from "@/components/website/rabbinical-endorsements";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
    q: "לא עוד: \"איך לא חשבתי על ההצעה הזו בעצמי\"",
    a: "קול מצהלות מביאה לכם פתרון מושלם עם לוח עבודה חדשני שיעזור לכם ליצור יותר הצעות! פשוט מסמנים שמות מעניינים מתוך המאגר, בוחרים מתוכם את המיועדים המועדפים, חושבים על הצעות מתאימות, יוצרים אותם בקלות ואפילו מקבלים פידבק אוטומטי חכם שבודק אם ההצעה הוצעה בעבר.",
  },
  {
    q: "הצעות טובות נופלות לכם בין הכסאות?",
    a: "אין יותר הצעות שסתם יורדות! שולחים את ההצעות ישירות מהמערכת, מקבלים תגובה מהירה משני הצדדים אם הם רוצים להתקדם או לא ומדוע, וכך עוקבים אחרי כל הצעה ומדייקים את ההצעות הבאות עד לסגירת שידוך בעז\"ה!",
  },
  {
    q: "צריכים דעה נוספת? עזרה בבירורים? ייעוץ בהתנהלות?",
    a: "פורום השדכנים והשדכניות של קול מצהלות נועד בדיוק עבור זה! כאן תוכלו לשאול ולברר כל דבר בנושא שידוכים, בממשק חדשני ונוח, בהפרדה מלאה ובפיקוח רוחני מלא!",
  },
];

export default function ShadchanPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <Section
        className="bg-primary text-primary-foreground"
        containerClassName="py-20 md:py-28 text-center space-y-6"
      >
        <h1 className="text-primary-foreground">שדכנים ושדכניות</h1>
        <p className="text-xl opacity-90">קול מצהלות כאן עבורכם!</p>
        <p className="mx-auto max-w-2xl opacity-80">
          מערכת קול מצהלות תוכננה ונבנתה במיוחד עבורכם, והיא כאן כדי לפתור את כל האתגרים שאתם
          מתמודדים איתם בהצעת וניהול שידוכים.
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

      {/* Simple CTA */}
      <Section className="bg-primary text-primary-foreground" containerClassName="py-12 text-center">
        <Button asChild size="lg" variant="secondary">
          <Link href="/auth/sign-up">הירשמו עכשיו</Link>
        </Button>
      </Section>
    </div>
  );
}
