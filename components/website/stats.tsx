import Section from "@/components/layout/section";

const STATS = [
  { num: "אלפי", desc: "מיועדים מקהילתנו הק' מופיעים במערכת" },
  { num: "מאות", desc: 'כרטיסי קו"ח מפורטים ומלאים ע"י ההורים' },
  { num: "עשרות", desc: 'שדכנים מובילים מאנ"ש כבר עובדים עם המערכת' },
];

export function WebStats() {
  return (
    <Section className="bg-muted/40" containerClassName="py-16">
      <div className="grid grid-cols-3 gap-6 text-center">
        {STATS.map(({ num, desc }) => (
          <div key={num} className="space-y-2">
            <p className="text-4xl font-extrabold text-primary md:text-5xl">{num}</p>
            <p className="text-xs leading-snug text-muted-foreground md:text-sm">{desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
