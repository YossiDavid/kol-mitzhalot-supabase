import { EndorsementsCarousel } from "@/components/website/endorsements-carousel";
import { fetchPublishedEndorsements } from "@/lib/endorsements";

export async function RabbinicalEndorsements() {
  const endorsements = await fetchPublishedEndorsements();

  if (!endorsements.length) {
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
