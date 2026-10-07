"use client";

import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type EndorsementSlide = {
  id: string;
  rav_name: string;
  rav_title: string | null;
  image_url: string | null;
  endorsement_text: string | null;
};

const CARD_SHELL =
  "flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

/**
 * תמונת ההסכמה, לחיצה עליה פותחת אותה בגודל מלא.
 * object-contain ולא cover: הסכמה סרוקה היא מסמך, וחיתוך שלו מסתיר שורות מהמכתב.
 */
function EndorsementImage({
  item,
  imageUrl,
}: {
  item: EndorsementSlide;
  imageUrl: string;
}) {
  const alt = `הסכמת ${item.rav_name}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group relative block aspect-[4/5] w-full cursor-zoom-in overflow-hidden bg-primary-stripe-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
          aria-label={`הגדלת ההסכמה של ${item.rav_name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 size-full object-contain"
          />
          <span className="absolute start-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-background/90 text-primary shadow-sm transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
            <Maximize2 className="size-4" aria-hidden="true" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        size="lg"
        className="max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>{item.rav_name}</DialogTitle>
          <DialogDescription>
            {item.rav_title ?? "הסכמה והמלצה"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-auto rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            className="mx-auto h-auto max-h-[75dvh] w-auto max-w-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * הסכמה אמיתית. ללא תמונה הכרטיס נשאר כרטיס טקסט בלבד: קודם נותרה כאן
 * תיבה ריקה ביחס 4/5, ששם הרב נדחק מתחתיה אל מחוץ למסך והמקטע נראה
 * כאילו לא הועלה דבר.
 */
export function EndorsementCard({ item }: { item: EndorsementSlide }) {
  const { image_url: imageUrl } = item;

  return (
    <article className={CARD_SHELL}>
      {imageUrl ? <EndorsementImage item={item} imageUrl={imageUrl} /> : null}
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
