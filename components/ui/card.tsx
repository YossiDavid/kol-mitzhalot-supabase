import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * מתכון הכרטיס האחד של המערכת. המשטח הוא `.box` (bg-card rounded-xl,
 * app/design-system.css) ועליו מסגרת, ריפוד ומרווח קבוע בין החלקים - ולכן
 * CardHeader / CardContent / CardFooter אינם מוסיפים ריפוד משלהם.
 *
 * default - כרטיס עצמאי בעמוד (טופס, פרופיל, פוסט, בקשה)
 * sm      - כרטיס ברשימה או ברשת, או כרטיס שיושב בתוך Box
 */
const cardVariants = cva(
  "box flex min-w-0 flex-col border border-border text-card-foreground",
  {
    variants: {
      size: {
        default: "gap-5 p-5 md:p-6",
        sm: "gap-4 p-4 md:p-5",
      },
    },
    defaultVariants: { size: "default" },
  },
);

type CardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants> & {
    /** מרנדר את הילד (article, Link) עם מחלקות הכרטיס */
    asChild?: boolean;
  };

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        data-slot="card"
        data-size={size ?? "default"}
        className={cn(cardVariants({ size }), className)}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

/**
 * כותרת: CardTitle ו-CardDescription זה מתחת לזה, ו-CardAction (אם יש)
 * בעמודה צמודה לתוכן בצד השני, בגובה שתי השורות.
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn(
      "grid auto-rows-min grid-cols-1 items-start gap-x-4 gap-y-1",
      className,
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

type CardTitleProps = React.HTMLAttributes<HTMLDivElement> & {
  /** לכותרת סמנטית: <CardTitle asChild><h2>…</h2></CardTitle> */
  asChild?: boolean;
};

const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "div";
    return (
      <Comp
        ref={ref}
        data-slot="card-title"
        className={cn(
          "text-subtitle leading-tight font-bold text-card-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-description"
    className={cn("text-body-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/** פעולות בכותרת (כפתור, תג) - בצד השני של הכותרת */
const CardAction = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-action"
    className={cn(
      "col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-start justify-self-end",
      className,
    )}
    {...props}
  />
));
CardAction.displayName = "CardAction";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-content"
    className={cn("min-w-0", className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn("flex flex-wrap items-center gap-2", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  cardVariants,
};
