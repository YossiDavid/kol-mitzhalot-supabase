export function RabbinicalEndorsements() {
  return (
    <section className="bg-[#ecf0f2]">
      <div className="mx-auto max-w-[1120px] px-6 py-[72px] text-center">
        <h2
          className="font-bold text-[#2b5a5c]"
          style={{ fontSize: "clamp(28px,3.4vw,42px)", lineHeight: 1.18, marginBottom: 40 }}
        >
          הסכמות והמלצות
          <br />
          <span
            className="inline-block rounded-[11px]"
            style={{
              background: "#2b5a5c",
              color: "#f4f8f7",
              padding: "1px 14px 4px",
              transform: "rotate(-1.5deg)",
            }}
          >
            רבני קהילתנו הק׳
          </span>
        </h2>
        <div className="flex flex-wrap justify-center gap-[18px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-[12px] border border-dashed border-[#c3ccce] bg-white font-mono text-[12px] text-[#a9b3b3]"
              style={{ width: 150, height: 112 }}
            >
              המלצה {i + 1}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
