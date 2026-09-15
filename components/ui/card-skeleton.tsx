import * as React from "react";

import { Card } from "@/components/ui/card";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DEFAULT_CARD_COUNT = 3;

/** גובה שדה ברירת מחדל - תואם ל-control-size (44px במובייל, 40px מ-md) */
const CONTROL_SKELETON_CLASS = "h-11 w-full md:h-10";

type CardSkeletonProps = {
  size?: "default" | "sm";
  /** כותרת ותיאור (ברירת מחדל: כן) */
  header?: boolean;
  /** זוגות תווית + שדה, לכרטיס טופס */
  fields?: number;
  /** שורות טקסט */
  lines?: number;
  /** כפתור בתחתית */
  footer?: boolean;
  /** "panel" - משטח Box בלי מסגרת, לתוכן שיושב ב-Box */
  surface?: "card" | "panel";
  className?: string;
  children?: React.ReactNode;
};

/**
 * שלד בצורת כרטיס. אינו role="status" בעצמו - עוטפים ב-SkeletonRegion
 * (או משתמשים ב-CardGridSkeleton) כדי שיהיה אזור טעינה אחד בעמוד.
 */
function CardSkeleton({
  size = "default",
  header = true,
  fields = 0,
  lines = 0,
  footer = false,
  surface = "card",
  className,
  children,
}: CardSkeletonProps) {
  return (
    <Card
      aria-hidden
      size={size}
      className={cn(surface === "panel" && "border-transparent", className)}
    >
      {header ? (
        <div className="space-y-2">
          <Skeleton className="h-6 w-40 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      ) : null}
      {fields > 0 ? (
        <div className="space-y-5">
          {Array.from({ length: fields }, (_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className={CONTROL_SKELETON_CLASS} />
            </div>
          ))}
        </div>
      ) : null}
      {lines > 0 ? (
        <div className="space-y-2">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton
              key={index}
              className={cn("h-4", index === lines - 1 ? "w-3/5" : "w-full")}
            />
          ))}
        </div>
      ) : null}
      {children}
      {footer ? <Skeleton className="h-11 w-32 md:h-10" /> : null}
    </Card>
  );
}

const GRID_COLUMNS_CLASS = {
  1: "grid gap-4",
  2: "grid gap-4 md:grid-cols-2",
  3: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
} as const;

type CardGridSkeletonProps = Omit<CardSkeletonProps, "children"> & {
  count?: number;
  columns?: keyof typeof GRID_COLUMNS_CLASS;
  /** מחלקות לכל כרטיס (למשל גובה מינימלי) */
  cardClassName?: string;
};

/** רשימה או רשת של כרטיסים בטעינה, כאזור טעינה אחד */
function CardGridSkeleton({
  count = DEFAULT_CARD_COUNT,
  columns = 1,
  className,
  cardClassName,
  ...cardProps
}: CardGridSkeletonProps) {
  return (
    <SkeletonRegion className={cn(GRID_COLUMNS_CLASS[columns], className)}>
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} className={cardClassName} {...cardProps} />
      ))}
    </SkeletonRegion>
  );
}

export { CardSkeleton, CardGridSkeleton };
