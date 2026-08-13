function StatCell({
  num,
  desc,
  middle,
}: {
  num: string;
  desc: string;
  middle?: boolean;
}) {
  return (
    <div
      className={
        middle
          ? "px-6 py-2 md:border-s md:border-e md:border-primary-foreground/15 md:px-10"
          : "px-6 py-2 md:px-10"
      }
    >
      <div className="text-hero font-extrabold leading-none text-brand-gold">
        {num}
      </div>
      <p className="mt-4 text-subtitle leading-[1.45] text-primary-foreground/80">
        {desc}
      </p>
    </div>
  );
}

export function WebStats() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="shell-site grid grid-cols-1 gap-12 py-20 text-center md:grid-cols-3 md:gap-0 md:py-24">
        <StatCell num="אלפי" desc="מיועדים מקהילתנו הק׳ מופיעים במערכת" />
        <StatCell
          num="מאות"
          desc='כרטיסי קו"ח מפורטים ומלאים ע"י ההורים'
          middle
        />
        <StatCell
          num="עשרות"
          desc='שדכנים מובילים מאנ"ש כבר עובדים עם המערכת'
        />
      </div>
    </section>
  );
}
