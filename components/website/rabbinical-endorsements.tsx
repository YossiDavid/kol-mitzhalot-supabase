import { createClient } from "@/lib/supabase/server";

export async function RabbinicalEndorsements() {
  const supabase = await createClient();
  const { data: endorsements } = await supabase
    .from("endorsements")
    .select("id, rav_name, rav_title, image_url, endorsement_text")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (!endorsements?.length) return null;

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-[1120px] px-6 py-[72px] text-center">
        <h2
          className="font-bold text-primary text-display" style={{lineHeight: 1.18, marginBottom: 40}}
        >
          הסכמות והמלצות
          <br />
          <span
            className="inline-block rounded-[11px]"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              padding: "1px 14px 4px",
              transform: "rotate(-1.5deg)",
            }}
          >
            רבני קהילתנו הק׳
          </span>
        </h2>
        <div className="flex flex-wrap justify-center gap-[18px]">
          {endorsements.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center gap-3 rounded-[14px] border border-border bg-card p-5 shadow-[0_1px_3px_rgba(20,40,40,.06)]"
              style={{ width: 170 }}
            >
              {item.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.image_url}
                  alt={item.rav_name}
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/12 text-title font-bold text-primary"
                >
                  {item.rav_name.charAt(0)}
                </div>
              )}
              <div className="text-center">
                <p className="text-body-sm font-bold text-foreground">{item.rav_name}</p>
                {item.rav_title && (
                  <p className="mt-0.5 text-caption text-muted-foreground">{item.rav_title}</p>
                )}
                {item.endorsement_text && (
                  <p className="mt-2 text-caption italic leading-relaxed text-muted-foreground line-clamp-3">
                    {item.endorsement_text}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
