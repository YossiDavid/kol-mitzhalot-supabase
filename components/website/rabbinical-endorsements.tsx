import { createClient } from "@/lib/supabase/server";
import { EndorsementsCarousel } from "@/components/website/endorsements-carousel";

export async function RabbinicalEndorsements() {
  const supabase = await createClient();
  const { data: endorsements } = await supabase
    .from("endorsements")
    .select("id, rav_name, rav_title, image_url, endorsement_text")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (!endorsements?.length) {
    return null;
  }

  return (
    <section className="bg-background">
      <div className="shell-site py-20 md:py-24">
        <EndorsementsCarousel items={endorsements} />
      </div>
    </section>
  );
}
