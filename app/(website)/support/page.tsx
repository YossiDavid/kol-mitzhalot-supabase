/**
 * Callers: footer /support link.
 * Replaces stub SupportPage. Links to /contact.
 * User: "2. לסדר את הלינקים ולהוסיף עמודים רלוונטיים."
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";

const faqs = [
  {
    q: "איך נרשמים למערכת?",
    a: "דרך כפתור ההרשמה באתר. לאחר האישור תוכלו למלא כרטיס קו״ח או להתחבר כשדכנים לפי ההרשאות.",
  },
  {
    q: "למי פונים בשאלות טכניות?",
    a: "לעמוד «צרו קשר» — נחזור אליכם בימי עסקים. לציין בנושא «תמיכה טכנית».",
  },
  {
    q: "איך מפרסמים מודעת מאורסים?",
    a: "בעמוד צרו קשר, בטופס «פרסום מודעת מאורסים». המודעה עולה לאתר רק לאחר בדיקה ואישור.",
  },
  {
    q: "שכחתי סיסמה / לא מצליח להתחבר",
    a: "השתמשו באפשרות איפוס הסיסמה במסך ההתחברות. אם הבעיה נמשכת — שלחו פנייה עם כתובת המייל של החשבון.",
  },
];

export default function SupportPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="bg-brand-gold-wash pointer-events-none absolute inset-0" />
        <div className="relative shell-site flex flex-col items-center justify-center py-24 text-center md:py-28">
          <h1 className="text-hero text-primary-foreground">שירות ותמיכה</h1>
          <p className="mt-8 max-w-2xl text-subtitle text-primary-foreground/85">
            תשובות לשאלות נפוצות ודרכי יצירת קשר עם הצוות.
          </p>
          <div className="mt-10">
            <Button
              asChild
              size="lg"
              className="bg-primary-foreground text-primary hover:bg-card hover:text-primary"
            >
              <Link href={"/contact" as any}>צרו קשר</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="shell-site max-w-3xl py-16 md:py-20">
          <h2 className="mb-10 text-center text-display font-bold text-primary">
            שאלות נפוצות
          </h2>
          <div className="flex flex-col gap-8">
            {faqs.map((item) => (
              <div key={item.q} className="border-b border-border pb-8 last:border-b-0">
                <h3 className="mb-2 text-subtitle font-bold text-foreground">
                  {item.q}
                </h3>
                <p className="text-body text-muted-foreground">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
