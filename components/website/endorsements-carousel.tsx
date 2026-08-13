"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export type EndorsementSlide = {
  id: string;
  rav_name: string;
  rav_title: string | null;
  image_url: string | null;
  endorsement_text: string | null;
};

const PLACEHOLDER_SLIDES: EndorsementSlide[] = [
  {
    id: "placeholder-1",
    rav_name: "הסכמת רב",
    rav_title: null,
    image_url: null,
    endorsement_text: null,
  },
  {
    id: "placeholder-2",
    rav_name: "הסכמת רב",
    rav_title: null,
    image_url: null,
    endorsement_text: null,
  },
  {
    id: "placeholder-3",
    rav_name: "הסכמת רב",
    rav_title: null,
    image_url: null,
    endorsement_text: null,
  },
  {
    id: "placeholder-4",
    rav_name: "הסכמת רב",
    rav_title: null,
    image_url: null,
    endorsement_text: null,
  },
  {
    id: "placeholder-5",
    rav_name: "הסכמת רב",
    rav_title: null,
    image_url: null,
    endorsement_text: null,
  },
];

function EndorsementCard({ item }: { item: EndorsementSlide }) {
  const isPlaceholder = item.id.startsWith("placeholder-");

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-primary-stripe-sm">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.rav_name}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span className="px-6 text-center font-mono text-body-sm text-muted-foreground">
            {isPlaceholder ? "[ תמונת הסכמת רב ]" : item.rav_name.charAt(0)}
          </span>
        )}
      </div>
      {!isPlaceholder ? (
        <div className="space-y-2 p-5 text-center">
          <h3 className="text-subtitle font-bold text-foreground">
            {item.rav_name}
          </h3>
          {item.rav_title ? (
            <p className="text-body-sm text-muted-foreground">
              {item.rav_title}
            </p>
          ) : null}
          {item.endorsement_text ? (
            <p className="text-body text-foreground/80">
              {item.endorsement_text}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Callers: home/about/parents. User: hide empty endorsements (item 4). */
export function EndorsementsCarousel({
  items,
  allowPlaceholders = false,
}: {
  items: EndorsementSlide[];
  allowPlaceholders?: boolean;
}) {
  if (items.length === 0 && !allowPlaceholders) {
    return null;
  }

  const slides = items.length > 0 ? items : PLACEHOLDER_SLIDES;

  return (
    <div className="w-full min-w-0">
      <p className="mb-6 text-center text-body-sm font-bold tracking-[0.08em] text-primary">
        הסכמות והמלצות רבני קהילתנו הק׳
      </p>

      <Carousel
        opts={{
          align: "start",
          loop: true,
          direction: "rtl",
        }}
        className="w-full"
      >
        <CarouselContent>
          {slides.map((item) => (
            <CarouselItem
              key={item.id}
              className="basis-[78%] pe-4 sm:basis-1/2 lg:basis-1/3"
            >
              <EndorsementCard item={item} />
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious className="start-2 border-border bg-background/95 shadow-sm md:start-3" />
        <CarouselNext className="end-2 border-border bg-background/95 shadow-sm md:end-3" />
      </Carousel>
    </div>
  );
}
