/**
 * Callers: footer /pricing link.
 * Replaces stub PricingPage. No DB API.
 * User: "2. לסדר את הלינקים ולהוסיף עמודים רלוונטיים."
 */
export default function PricingPage() {
  const plans = [
    {
      name: "בסיסי",
      price: "ללא עלות",
      desc: "הרשמה ראשונית להורים ומיועדים — מילוי כרטיס קו״ח וקבלת הצעות.",
      points: ["כרטיס קו״ח במערכת", "קבלת הצעות משדכנים", "תגובה להצעות"],
    },
    {
      name: "לשדכנים",
      price: "לפי מסלול",
      desc: "גישה מלאה לניהול הצעות, מעקב ומודעות פרימיום — פרטים יעודכנו בקרוב.",
      points: ["מאגר מיועדים", "שליחת הצעות", "מעקב תהליכים"],
    },
    {
      name: "פרימיום",
      price: "בקרוב",
      desc: "שדרוגים נוספים להורים ולשדכנים. נפרסם מחירים סופיים לפני השקה מלאה.",
      points: ["חשיפה מוגברת", "כלים מתקדמים", "תמיכה מועדפת"],
    },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="bg-brand-gold-wash pointer-events-none absolute inset-0" />
        <div className="relative shell-site flex flex-col items-center justify-center py-24 text-center md:py-28">
          <h1 className="text-hero text-primary-foreground">מסלולים</h1>
          <p className="mt-8 max-w-2xl text-subtitle text-primary-foreground/85">
            סקירת מסלולי השימוש במערכת — המחירים הסופיים יפורסמו לפני ההשקה
            המלאה.
          </p>
        </div>
      </section>

      <section className="bg-background">
        <div className="shell-site grid grid-cols-1 gap-8 py-16 md:grid-cols-3 md:py-20">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className="flex flex-col gap-4 border-b border-border pb-8 md:border-b-0 md:border-e md:pb-0 md:pe-8 last:md:border-e-0 last:md:pe-0"
            >
              <h2 className="text-display font-bold text-primary">{plan.name}</h2>
              <p className="text-subtitle font-bold text-foreground">
                {plan.price}
              </p>
              <p className="text-body text-muted-foreground">
                {plan.desc}
              </p>
              <ul className="m-0 list-disc space-y-2 ps-5 text-body-sm text-foreground">
                {plan.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
