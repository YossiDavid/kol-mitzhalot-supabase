"use client";

import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import {
  EndorsementCard,
  type EndorsementSlide,
} from "@/components/website/endorsement-card";
import { ENDORSEMENTS_PAGE_HREF } from "@/components/website/endorsements-anchor";
import { cn } from "@/lib/utils";

export type { EndorsementSlide };

const PLACEHOLDER_IDS = [
  "placeholder-1",
  "placeholder-2",
  "placeholder-3",
  "placeholder-4",
  "placeholder-5",
] as const;

const CAROUSEL_ITEM_BASIS = "basis-[78%] pe-4 sm:basis-1/2 lg:basis-1/3";

/** זמן הצגה של כל שקופית בגלילה אוטומטית */
const AUTOPLAY_INTERVAL_MS = 5000;

/** מעל מספר זה לא מציירים נקודה לכל הסכמה, כדי שלא יציפו את השורה */
const MAX_DOTS = 12;

type CarouselApi = NonNullable<
  Parameters<NonNullable<React.ComponentProps<typeof Carousel>["setApi"]>>[0]
>;

/** תיבת "בקרוב" עבור שלדי הדמו בלבד (ראה PLACEHOLDER_IDS) */
function PlaceholderCard() {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-primary-stripe-sm">
        <span className="px-6 text-center font-mono text-body-sm text-muted-foreground">
          [ תמונת הסכמת רב ]
        </span>
      </div>
    </article>
  );
}

/** העדפת המשתמש להפחתת תנועה: בלעדיה אין גלילה אוטומטית */
function usePrefersReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setIsReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isReduced;
}

/**
 * גלילה אוטומטית שנעצרת בריחוף ובפוקוס, כשהלשונית מוסתרת, אחרי בחירת
 * המשתמש בכפתור "השהיה", ובכלל כשהמשתמש ביקש להפחית תנועה.
 */
function useAutoplay(api: CarouselApi | undefined, isEnabled: boolean) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);

  useEffect(() => {
    const sync = () => setIsTabHidden(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const isRunning = isEnabled && !isHovered && !isFocused && !isTabHidden;

  useEffect(() => {
    if (!api || !isRunning) return;
    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [api, isRunning]);

  const pauseHandlers = {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
    onFocusCapture: () => setIsFocused(true),
    onBlurCapture: () => setIsFocused(false),
  };

  return pauseHandlers;
}

function useCarouselSelection(api: CarouselApi | undefined) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      setSelectedIndex(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
    };
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  return { selectedIndex, snapCount };
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-lg"
      onClick={onClick}
      aria-label={label}
      className="size-12 rounded-full shadow-sm"
    >
      {children}
    </Button>
  );
}

function CarouselControls({
  api,
  selectedIndex,
  snapCount,
  isAutoplayOn,
  canAutoplay,
  onToggleAutoplay,
}: {
  api: CarouselApi | undefined;
  selectedIndex: number;
  snapCount: number;
  isAutoplayOn: boolean;
  canAutoplay: boolean;
  onToggleAutoplay: () => void;
}) {
  const goTo = useCallback((index: number) => api?.scrollTo(index), [api]);
  const showDots = snapCount > 1 && snapCount <= MAX_DOTS;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
      {/* ברצף RTL: "הקודם" מימין ו"הבא" משמאל */}
      <ControlButton label="ההסכמה הקודמת" onClick={() => api?.scrollPrev()}>
        <ArrowRight className="size-5" aria-hidden="true" />
      </ControlButton>

      <div className="flex min-w-32 flex-col items-center gap-2">
        {showDots ? (
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: snapCount }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`מעבר להסכמה ${index + 1}`}
                aria-current={index === selectedIndex ? "true" : undefined}
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "block h-2.5 rounded-full transition-[width,background-color]",
                    index === selectedIndex
                      ? "w-6 bg-primary"
                      : "w-2.5 bg-border hover:bg-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}
        {snapCount > 0 ? (
          <p className="text-body-sm font-bold text-primary" aria-live="polite">
            {selectedIndex + 1} מתוך {snapCount}
          </p>
        ) : null}
      </div>

      <ControlButton label="ההסכמה הבאה" onClick={() => api?.scrollNext()}>
        <ArrowLeft className="size-5" aria-hidden="true" />
      </ControlButton>

      {canAutoplay ? (
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={onToggleAutoplay}
          aria-label={
            isAutoplayOn ? "השהיית הגלילה האוטומטית" : "הפעלת הגלילה האוטומטית"
          }
          className="size-12 rounded-full"
        >
          {isAutoplayOn ? (
            <Pause className="size-5" aria-hidden="true" />
          ) : (
            <Play className="size-5" aria-hidden="true" />
          )}
        </Button>
      ) : null}
    </div>
  );
}

/** Callers: home/about/parents/shadchanim. User: "רק 3 רואים" - כל ההסכמות חייבות להיות ניתנות לגילוי. */
export function EndorsementsCarousel({
  items,
  allowPlaceholders = false,
}: {
  items: EndorsementSlide[];
  allowPlaceholders?: boolean;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [isAutoplayOn, setIsAutoplayOn] = useState(true);
  const isReducedMotion = usePrefersReducedMotion();
  const { selectedIndex, snapCount } = useCarouselSelection(api);
  const pauseHandlers = useAutoplay(api, isAutoplayOn && !isReducedMotion);

  if (items.length === 0 && !allowPlaceholders) {
    return null;
  }

  const showPlaceholders = items.length === 0;

  return (
    <div className="w-full min-w-0">
      <p className="mb-6 text-center text-body-sm font-bold tracking-[0.08em] text-primary">
        הסכמות והמלצות רבני קהילתנו הק׳
      </p>

      <div {...pauseHandlers}>
        <Carousel
          opts={{
            align: "start",
            loop: true,
            direction: "rtl",
          }}
          setApi={setApi}
          className="w-full"
          aria-label="הסכמות והמלצות רבנים"
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
        </Carousel>

        <CarouselControls
          api={api}
          selectedIndex={selectedIndex}
          snapCount={snapCount}
          isAutoplayOn={isAutoplayOn && !isReducedMotion}
          canAutoplay={!isReducedMotion && snapCount > 1}
          onToggleAutoplay={() => setIsAutoplayOn((value) => !value)}
        />
      </div>

      {!showPlaceholders ? (
        <div className="mt-6 text-center">
          <Button asChild variant="link" className="text-body font-bold">
            <Link href={ENDORSEMENTS_PAGE_HREF as never}>
              לכל ההסכמות ({items.length})
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
