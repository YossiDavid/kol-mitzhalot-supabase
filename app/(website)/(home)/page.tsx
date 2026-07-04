import Section from "@/components/layout/section";
import Box from "@/components/layout/box";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  CheckCircle,
  Lock,
  BookOpen,
  Users,
  ArrowLeft,
} from "lucide-react";

const steps = [
  {
    audience: "הורים או מיועדים בוגרים",
    desc: 'ממלאים כרטיס קו"ח מפורט שעולה למערכת ומוצג לשדכנים מורשים בלבד.',
  },
  {
    audience: "רבנים, משפיעים וצוות מוסדות החינוך",
    desc: "כותבים על הכרטיס א גוט ווארט ומחמאות, מהכירותם האישית עם המיועדים.",
  },
  {
    audience: "השדכנים והשדכניות במערכת",
    desc: "צופים ומכירים לעומק את המיועדים, יוצרים הצעות שידוכים ושולחים אותן ישירות מהמערכת.",
  },
  {
    audience: "שני הצדדים שקיבלו את ההצעה",
    desc: "מגיבים ישירות לשדכנים במקום ובזמן שנוח, ומקדמים את השידוך המתאים בקלות.",
  },
];

const audiences = [
  {
    title: "הורים ומיועדים",
    desc: 'שדכנים לא מתקשרים להציע? רוצים שעוד שדכנים מקצועיים יכירו אתכם? מערכת קול מצהלות עוזרת לשדכנים להכיר אתכם ולהציע לכם הצעות שמתאימות בדיוק לכם!',
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
    desc: 'שורפים שעות על בירורים בסיסיים? הולכים לאיבוד בתוך ים הניירת? הצטרפו לקול מצהלות ותהנו ממאגר מידע עדכני עם קו"ח מפורטים!',
    features: [
      { title: "מאגר מתעדכן!", desc: "עם אפשרויות חיפוש, סינון, מיון ושיתוף מהיר" },
      { title: "ניהול שידוכים!", desc: "יוצרים הצעות שידוך, שולחים לצדדים ומקבלים משוב" },
      { title: "בדיקת הצעות", desc: "בדיקה אוטומטית חכמה לפני שליחת ההצעה" },
    ],
    cta: "לקול מצהלות לשדכנים",
    href: "/shadchanim" as any,
  },
  {
    title: "רבנים וצוותי חינוך",
    desc: "רוצים לסייע לתלמידים ולתלמידות שלכם במציאת שידוך מתאים? הירשמו לקול מצהלות וכתבו מחמאות ותשבחות על כרטיסי המיועדים המתחנכים אצלכם.",
    features: [
      { title: "פרטיות מובטחת!", desc: "רק שדכנים מורשים חשופים למה שכתבתם" },
      { title: "חיסכון בזמן!", desc: "במקום לענות לכל המבררים כותבים פעם אחת וזהו" },
      { title: "חסד אמיתי!", desc: "המחמאה שלכם יכולה לגרום לשידוך להגיע" },
    ],
    cta: "להרשמה מהירה ללא עלות",
    href: "/auth/sign-up" as const,
  },
];

const principles = [
  {
    icon: Users,
    title: 'הכוונה וליווי מקיף של רבני הארגון שליט"א',
    desc: 'הארגון הוקם על ידי שדכנים ועסקנים יר"ש, ומתנהל בליווי והכוונה שוטפים של הגה"צ ר\' שמאי גרוס והגה"צ ר\' שמואל יעקב לנדאו.',
  },
  {
    icon: Lock,
    title: "פרטיות ואבטחת מידע ללא פשרות",
    desc: "אנו מתייחסים במלוא הרצינות לפרטיות שלכם! המערכת משתמשת בתקני אבטחה מתקדמים במיוחד, וההנהלה בודקת לעומק כל שדכן לפני מתן גישה למידע.",
  },
  {
    icon: BookOpen,
    title: 'התנהלות ערכית וללא חשש לשה"ר',
    desc: "המערכת בנויה ברוח התורה והחסידות: אין אפשרות לכתוב מידע שלילי, כל תגובה נבדקת לפני פרסומה ותמונות נשלחות תוך שמירה מוקפדת על פרטיות וצניעות.",
  },
];

const articles = [
  "10 נקודות קריטיות שהורים שוכחים לברר",
  "דמי שדכנות - האם הגיע הזמן לשינוי?",
  "מתי אומרים? הכל על בעיות רפואיות בשידוכים",
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 1. HERO */}
      <Section
        className="bg-primary text-primary-foreground"
        containerClassName="py-20 md:py-32"
      >
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          <Link
            href="/auth/sign-up"
            className="inline-flex items-center gap-1 rounded-full border border-primary-foreground/30 bg-primary-foreground/10 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-primary-foreground/20"
          >
            יש לי רעיון לשידוך
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>

          <div className="space-y-2">
            <p className="text-lg font-medium opacity-80">
              שדכנים, הורים, אנשי ונשות חינוך, מחפשי שידוך בוגרים — ברוכים הבאים
            </p>
            <h1 className="text-5xl font-extrabold leading-tight text-primary-foreground md:text-7xl">
              קול מצהלות
            </h1>
            <p className="text-xl font-semibold opacity-90 md:text-2xl">
              הארגון לקידום שידוכים בבעלזא
            </p>
          </div>

          <ul className="mx-auto inline-flex max-w-xl flex-col gap-3 text-start text-base">
            {[
              "מערכת חדשנית להצעות וניהול שידוכים",
              'מאגר מתעדכן ונוח עם מיועדים ומיועדות מאנ"ש',
              "רשימת שדכנים נבחרים בקהילתנו הק'",
              "פורום שדכנים מתקדם לשיתוף מידע והתייעצות",
              "בהמלצת ובפיקוח רבני קהילתינו הק'",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 opacity-90" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link href="/auth/sign-up">הירשמו עכשיו ללא עלות</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link href={"/contact" as any}>דברו איתנו</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* 2. MISSION + STATS */}
      <Section containerClassName="py-16 md:py-24">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <h2>המטרה שלנו ושלכם</h2>
            <p className="text-muted-foreground leading-relaxed">
              לקדם שידוכים ולהקים בתים נאמנים בישראל. בסייעתא דשמיא, בברכת הקודש ובהכוונת רבנים
              חשובים בקהילתינו הק', הושקעו משאבים רבים בסיוע נדיבים על מנת להקים את מערכת קול
              מצהלות, מתוך תחושת שליחות, אחריות ורצון לקדם את ענייני השידוכים בקהילתנו.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              המערכת נועדה לשמש ככתובת לכל נושא השידוכים בקהילתנו הק' וככלי עזר נוח להורים,
              שדכנים, רבנים ואנשי ונשות החינוך במוסדותינו ברחבי העולם, במטרה לסייע במציאת זיווג
              הגון בדרך קלה ונוחה, תוך שמירה על ערכי הקדושה וצנעת הפרט.
            </p>
            <Button asChild variant="link" className="px-0">
              <Link href={"/about" as any} className="flex items-center gap-1">
                עוד על קול מצהלות
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { num: "אלפי", desc: "מיועדים ומיועדות מבעלזא מופיעים במערכת" },
              { num: "מאות", desc: 'כרטיסי קו"ח מפורטים ומלאים ע"י ההורים' },
              { num: "עשרות", desc: 'שדכנים מובילים מאנ"ש כבר עובדים עם המערכת' },
            ].map(({ num, desc }) => (
              <div key={num} className="space-y-2">
                <p className="text-4xl font-extrabold text-primary md:text-5xl">{num}</p>
                <p className="text-xs leading-snug text-muted-foreground md:text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 3. HOW IT WORKS */}
      <Section className="bg-muted/40" containerClassName="py-16 md:py-24">
        <div className="space-y-10">
          <div className="space-y-2 text-center">
            <h2>איך עובדת מערכת קול מצהלות?</h2>
            <p className="text-muted-foreground">
              בשילוב מושלם של טכנולוגיה, מידע, שיתוף ובברכת רבני קהילתינו הק'.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <Box key={i} className="flex flex-col gap-3 p-6 text-center">
                <span className="text-5xl font-black leading-none text-primary/20">{i + 1}</span>
                <h3 className="text-sm font-bold">{step.audience}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </Box>
            ))}
          </div>
        </div>
      </Section>

      {/* 4. WHO IS IT FOR */}
      <Section containerClassName="py-16 md:py-24">
        <div className="space-y-10">
          <div className="space-y-2 text-center">
            <h2>למי המערכת מתאימה?</h2>
            <p className="text-muted-foreground">
              לכל העוסקים בתחום כמקצוע, כשליחות, או עבור עצמם, ילדיהם ותלמידיהם.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {audiences.map((aud) => (
              <Box key={aud.title} className="flex flex-col gap-4 p-6">
                <h3 className="text-xl font-bold text-primary">{aud.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{aud.desc}</p>
                <ul className="flex flex-col gap-3">
                  {aud.features.map((f) => (
                    <li key={f.title} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>
                        <span className="font-semibold">{f.title}</span>
                        <br />
                        <span className="text-muted-foreground">{f.desc}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  <Button asChild className="w-full">
                    <Link href={aud.href}>{aud.cta}</Link>
                  </Button>
                </div>
              </Box>
            ))}
          </div>
        </div>
      </Section>

      {/* 5. PRINCIPLES */}
      <Section className="bg-muted/40" containerClassName="py-16 md:py-24">
        <div className="space-y-10">
          <div className="space-y-2 text-center">
            <h2>העקרונות של קול מצהלות</h2>
            <p className="text-muted-foreground">
              הכללים שלנו נוסחו מתוך הבנת האחריות העצומה והרגישות הנדרשת בתחום.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {principles.map((p) => {
              const Icon = p.icon;
              return (
                <Box key={p.title} className="flex flex-col gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                </Box>
              );
            })}
          </div>
        </div>
      </Section>

      {/* 6. SCREENSHOTS */}
      <Section containerClassName="py-16 md:py-24">
        <div className="space-y-10">
          <div className="space-y-2 text-center">
            <h2>איך זה נראה מבפנים?</h2>
            <p className="text-muted-foreground">מה בדיוק עושים? מה האפשרויות שם? כנסו לראות!</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              { label: "מערכת קול מצהלות להורים ולמיועדים", href: "/parents" as any },
              { label: "מערכת קול מצהלות לשדכנים", href: "/shadchanim" as any },
            ].map((item) => (
              <Box key={item.label} className="flex flex-col gap-4 p-6">
                <div className="aspect-video rounded-lg bg-muted" />
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{item.label}</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={item.href} className="flex items-center gap-1">
                      כנסו לראות
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </Box>
            ))}
          </div>
        </div>
      </Section>

      {/* 7. RABBINICAL ENDORSEMENTS */}
      <Section className="bg-muted/40" containerClassName="py-16 md:py-24">
        <div className="space-y-8 text-center">
          <h2>הסכמות והמלצות רבני קהילתנו הק'</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex h-24 w-32 items-center justify-center rounded-xl border border-border bg-muted text-xs text-muted-foreground/40"
              >
                המלצה {i + 1}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 8. RECENT ENGAGEMENTS */}
      <Section containerClassName="py-16 md:py-24">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2>שידוכים שנסגרו למזל טוב</h2>
            <div className="hidden gap-2 md:flex">
              <Button asChild variant="outline" size="sm">
                <Link href={"/whats-new" as any}>לכל מה שחדש</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={"/whats-new#update" as any}>לעדכון מודעת מאורסים</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Box
                key={i}
                className="flex aspect-[3/4] items-center justify-center text-center text-xs text-muted-foreground"
              >
                מודעת מאורסים
              </Box>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 md:hidden">
            <Button asChild variant="outline" size="sm">
              <Link href={"/whats-new" as any}>לכל מה שחדש</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={"/whats-new#update" as any}>לעדכון מודעת מאורסים</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* 9. KNOWLEDGE CENTER */}
      <Section className="bg-muted/40" containerClassName="py-16 md:py-24">
        <div className="space-y-8">
          <div className="space-y-2 text-center">
            <h2>מרכז הידע של קול מצהלות</h2>
            <p className="text-muted-foreground">
              כל מה שחשוב לדעת על שידוכים, בירורים, פגישות, אירוסין ומה שביניהם.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {articles.map((title) => (
              <Box
                key={title}
                asChild
                className="flex cursor-pointer flex-col gap-3 p-6 transition-shadow hover:shadow-md"
              >
                <Link href={"/knowledge" as any}>
                  <p className="font-semibold leading-snug">{title}</p>
                  <span className="mt-auto flex items-center gap-1 text-sm text-primary">
                    לקריאה
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </span>
                </Link>
              </Box>
            ))}
          </div>
        </div>
      </Section>

      {/* 10. FINAL CTA */}
      <Section
        className="bg-primary text-primary-foreground"
        containerClassName="py-16 md:py-24"
      >
        <div className="mx-auto max-w-2xl space-y-8 text-center">
          <div className="space-y-2">
            <h2 className="text-primary-foreground">רוצים פשוט להתחיל?</h2>
            <p className="opacity-85">
              הירשמו עכשיו ללא עלות ותהנו מכל מה שיש לקול מצהלות להציע לכם!
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" variant="secondary">
              <Link href="/auth/sign-up">הרשמת הורים ומיועדים</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/auth/sign-up">הרשמת שדכנים ושדכניות</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/auth/sign-up">הרשמת רבנים וצוותי חינוך</Link>
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
