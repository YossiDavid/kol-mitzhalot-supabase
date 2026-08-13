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
          ? "px-5 py-1.5 md:[border-inline-start:1px_solid_rgba(255,255,255,.14)] md:[border-inline-end:1px_solid_rgba(255,255,255,.14)]"
          : "px-5 py-1.5"
      }
    >
      <div
        className="font-bold leading-none text-brand-gold text-display"
      >
        {num}
      </div>
      <div className="mt-2 text-body leading-[1.45] opacity-[.82]">{desc}</div>
    </div>
  );
}

export function WebStats() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 md:grid-cols-3 px-6 py-14 text-center">
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
