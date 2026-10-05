import { Flame, HeartPulse, PartyPopper, Sprout } from "lucide-react";

/** אפשרויות ההקדשה - טקסט סטטי, ללא רשימת הנצחות קודמות */
const DEDICATIONS = [
  {
    title: "לעילוי נשמת",
    text: "הנצחת יקיר שהלך לבית עולמו, בדרך שמוסיפה שמחה לבתים אחרים.",
    icon: Flame,
  },
  {
    title: "לרפואת",
    text: "תרומה לרפואתו ולרפואתה השלמה של חולה מישראל.",
    icon: HeartPulse,
  },
  {
    title: "לזכות",
    text: "לזכות בן משפחה, חבר או מיועד, בשעה טובה ומוצלחת.",
    icon: PartyPopper,
  },
  {
    title: "להצלחת",
    text: "להצלחתו של בחור או בחורה בדרך אל הבית הנאמן.",
    icon: Sprout,
  },
] as const;

export function DedicationsSection() {
  return (
    <section id="dedications" className="bg-primary-wash">
      <div className="shell-site py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-display font-bold text-primary">הנצחות</h2>
          <p className="mt-4 text-body text-muted-foreground">
            אפשר להקדיש את התרומה לזכר, לרפואה או לזכות אדם יקר. בטופס התרומה
            בוחרים סוג הקדשה ומזינים שם, והוא נרשם יחד עם התרומה.
          </p>
        </div>

        <ul className="m-0 mt-12 grid list-none grid-cols-1 gap-8 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {DEDICATIONS.map(({ title, text, icon: Icon }) => (
            <li key={title} className="flex flex-col gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-gold-muted text-brand-gold-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="text-subtitle font-bold text-foreground">
                {title}
              </h3>
              <p className="text-body-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
