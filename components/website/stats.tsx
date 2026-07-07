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
      className="px-5 py-1.5"
      style={
        middle
          ? {
              borderInlineStart: "1px solid rgba(255,255,255,.14)",
              borderInlineEnd: "1px solid rgba(255,255,255,.14)",
            }
          : undefined
      }
    >
      <div
        className="font-bold leading-none text-[#e7c877]"
        style={{ fontSize: "clamp(40px,5vw,54px)" }}
      >
        {num}
      </div>
      <div className="mt-2 text-[15px] leading-[1.45] opacity-[.82]">{desc}</div>
    </div>
  );
}

export function WebStats() {
  return (
    <section className="bg-[#123c3b] text-[#f4f8f7]">
      <div className="mx-auto grid max-w-[1120px] grid-cols-3 px-6 py-14 text-center">
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
