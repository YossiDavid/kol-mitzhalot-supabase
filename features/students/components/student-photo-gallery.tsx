"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type GalleryPhoto = { url: string };

/** כמה תמונות ממוזערות מוצגות מתחת לתמונה הראשית; השאר מאחורי "+N" */
const VISIBLE_THUMBNAILS = 3;

/**
 * גלריית התמונות של מיועד: התמונה הראשית (הראשונה), תמונות ממוזערות
 * מתחתיה, ו-lightbox לדפדוף בכולן. מקבלת רק קישורים שהשרת כבר חתם לצופה
 * מורשה - ראה loadStudentPhotos.
 */
export default function StudentPhotoGallery({
  photos,
  alt,
}: {
  photos: readonly GalleryPhoto[];
  alt: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const [mainPhoto, ...otherPhotos] = photos;
  const visibleThumbnails = otherPhotos.slice(0, VISIBLE_THUMBNAILS);
  const hiddenCount = otherPhotos.length - visibleThumbnails.length;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpenIndex(0)}
        aria-label={
          photos.length > 1
            ? `פתיחת גלריית התמונות (${photos.length} תמונות)`
            : "הגדלת התמונה"
        }
        className="relative cursor-zoom-in rounded-full transition hover:ring-2 hover:ring-primary/40 hover:brightness-95"
      >
        <img
          src={mainPhoto.url}
          alt={alt}
          className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
        />
        {photos.length > 1 && (
          <span className="absolute end-0 -bottom-1 flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-caption font-bold text-primary-foreground">
            <Images className="size-3" aria-hidden />
            {photos.length}
          </span>
        )}
      </button>

      {visibleThumbnails.length > 0 && (
        <div className="flex gap-1">
          {visibleThumbnails.map((photo, index) => {
            const photoIndex = index + 1;
            const showHiddenCount =
              hiddenCount > 0 && index === visibleThumbnails.length - 1;
            return (
              <button
                key={photo.url}
                type="button"
                onClick={() => setOpenIndex(photoIndex)}
                aria-label={`תמונה ${photoIndex + 1} מתוך ${photos.length}`}
                className="relative size-8 cursor-zoom-in overflow-hidden rounded-md border transition hover:ring-2 hover:ring-primary/40"
              >
                <img
                  src={photo.url}
                  alt=""
                  className="size-full object-cover"
                />
                {showHiddenCount && (
                  <span className="absolute inset-0 flex items-center justify-center bg-foreground/60 text-caption font-bold text-background">
                    +{hiddenCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <PhotoLightbox
        photos={photos}
        alt={alt}
        startIndex={openIndex}
        onClose={() => setOpenIndex(null)}
      />
    </div>
  );
}

function PhotoLightbox({
  photos,
  alt,
  startIndex,
  onClose,
}: {
  photos: readonly GalleryPhoto[];
  alt: string;
  /** null = סגור */
  startIndex: number | null;
  onClose: () => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const isOpen = startIndex !== null;
  const hasMany = photos.length > 1;

  useEffect(() => {
    if (!api) return;
    const handleSelect = () => setCurrent(api.selectedScrollSnap());
    handleSelect();
    api.on("select", handleSelect);
    return () => {
      api.off("select", handleSelect);
    };
  }, [api]);

  // בעברית "הבאה" נמצאת משמאל - החיצים במקלדת הולכים לפי הכיוון הנראה
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!api) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      api.scrollNext();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      api.scrollPrev();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={handleKeyDown}
        className="w-[95vw] max-w-[95vw] gap-3 border-none bg-transparent p-0 shadow-none sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          גלריית תמונות. אפשר לדפדף בחיצים או בהחלקה.
        </DialogDescription>

        <DialogClose
          aria-label="סגירה"
          className="absolute end-2 top-2 z-10 rounded-full bg-foreground/60 p-2 text-background transition hover:bg-foreground/80 focus:ring-2 focus:ring-background focus:outline-hidden"
        >
          <X className="h-5 w-5" />
        </DialogClose>

        {isOpen && (
          <div className="relative">
            <Carousel
              setApi={setApi}
              opts={{ direction: "rtl", startIndex: startIndex ?? 0 }}
            >
              <CarouselContent className="ml-0">
                {photos.map((photo, index) => (
                  <CarouselItem key={photo.url} className="pl-0">
                    <div className="flex h-[80vh] items-center justify-center">
                      <img
                        src={photo.url}
                        alt={`${alt} - תמונה ${index + 1}`}
                        className="max-h-full max-w-full rounded-lg object-contain"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            {hasMany && (
              <>
                <button
                  type="button"
                  onClick={() => api?.scrollPrev()}
                  disabled={current === 0}
                  aria-label="התמונה הקודמת"
                  className="absolute start-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/60 p-2 text-background transition hover:bg-foreground/80 disabled:opacity-30"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => api?.scrollNext()}
                  disabled={current === photos.length - 1}
                  aria-label="התמונה הבאה"
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full bg-foreground/60 p-2 text-background transition hover:bg-foreground/80 disabled:opacity-30"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <p
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-foreground/60 px-3 py-1 text-caption text-background tabular-nums"
                  aria-live="polite"
                  // בלי ltr, בתוך עמוד RTL המונה מתהפך ל-"3 / 2"
                  dir="ltr"
                >
                  {current + 1} / {photos.length}
                </p>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
