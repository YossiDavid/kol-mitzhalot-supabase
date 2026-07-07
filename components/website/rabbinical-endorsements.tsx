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
          {endorsements.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center gap-3 rounded-[14px] border border-[#d9dee0] bg-white p-5 shadow-[0_1px_3px_rgba(20,40,40,.06)]"
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
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(43,90,92,.12)] text-[22px] font-bold text-[#2b5a5c]"
                >
                  {item.rav_name.charAt(0)}
                </div>
              )}
              <div className="text-center">
                <p className="text-[14px] font-bold text-[#1b2523]">{item.rav_name}</p>
                {item.rav_title && (
                  <p className="mt-0.5 text-[12px] text-[#5c6a68]">{item.rav_title}</p>
                )}
                {item.endorsement_text && (
                  <p className="mt-2 text-[12px] italic leading-relaxed text-[#66716f] line-clamp-3">
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
