"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export type EndorsementSlide = {
  id: string;
  rav_name: string;
  rav_title: string | null;
  image_url: string | null;
  endorsement_text: string | null;
};

const PLACEHOLDER_IDS = [
  "placeholder-1",
  "placeholder-2",
  "placeholder-3",
  "placeholder-4",
  "placeholder-5",
] as const;

const CAROUSEL_ITEM_BASIS = "basis-[78%] pe-4 sm:basis-1/2 lg:basis-1/3";

const CARD_SHELL =
  "flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

/** תיבת "בקרוב" עבור שלדי הדמו בלבד (ראה PLACEHOLDER_IDS) */
function PlaceholderCard() {
  return (
    <article className={CARD_SHELL}>
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-primary-stripe-sm">
        <span className="px-6 text-center font-mono text-body-sm text-muted-foreground">
          [ תמונת הסכמת רב ]
        </span>
      </div>
    </article>
  );
}

/**
 * הסכמה אמיתית. ללא תמונה הכרטיס נשאר כרטיס טקסט בלבד: קודם נותרה כאן
 * תיבה ריקה ביחס 4/5 (מעל 800px גובה), ששם הרב נדחק מתחתיה אל מחוץ למסך
 * והמקטע נראה כאילו לא הועלה דבר.
 */
function EndorsementCard({ item }: { item: EndorsementSlide }) {
  const { image_url: imageUrl } = item;

  return (
    <article className={CARD_SHELL}>
      {imageUrl ? (
        <div className="relative aspect-[4/5] overflow-hidden bg-primary-stripe-sm">
          {/* object-contain ולא cover: הסכמה סרוקה היא מסמך, וחיתוך שלו
              מסתיר שורות מהמכתב */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={`הסכמת ${item.rav_name}`}
            className="absolute inset-0 size-full object-contain"
          />
        </div>
      ) : null}
      <div
        className={cn(
          "flex flex-1 flex-col justify-center gap-2 p-5 text-center",
          !imageUrl && "min-h-48",
        )}
      >
        <h3 className="text-subtitle font-bold text-foreground">
          {item.rav_name}
        </h3>
        {item.rav_title ? (
          <p className="text-body-sm text-muted-foreground">{item.rav_title}</p>
        ) : null}
        {item.endorsement_text ? (
          <p className="text-body text-foreground/80">
            {item.endorsement_text}
          </p>
        ) : null}
      </div>
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

  const showPlaceholders = items.length === 0;

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
          {showPlaceholders
            ? PLACEHOLDER_IDS.map((id) => (
                <CarouselItem key={id} className={CAROUSEL_ITEM_BASIS}>
                  <PlaceholderCard />
                </CarouselItem>
              ))
            : items.map((item) => (
                <CarouselItem key={item.id} className={CAROUSEL_ITEM_BASIS}>
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
