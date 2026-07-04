import Section from "@/components/layout/section";

export function RabbinicalEndorsements() {
  return (
    <Section containerClassName="py-16">
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
  );
}
