import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * מצב ריק. size:
 *   default - רשימה או עמוד שלמים ריקים (הצעות, פורום, רשימת מיועדים)
 *   compact - בתוך מקטע או כרטיס (מקטעי לוח הבקרה, טבלה בתוך Box)
 * surface={false} כשהמצב הריק כבר יושב על משטח (Box, Card, חלונית צ'אט).
 */
const emptyVariants = cva(
  "group/empty flex min-w-0 flex-1 flex-col items-center justify-center text-center text-balance",
  {
    variants: {
      size: {
        default: "gap-6 px-6 py-10 md:p-12",
        compact: "gap-4 px-4 py-8 md:py-10",
      },
      surface: {
        true: "box",
        false: "",
      },
    },
    defaultVariants: { size: "default", surface: true },
  },
);

function Empty({
  className,
  size,
  surface,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyVariants>) {
  return (
    <div
      data-slot="empty"
      data-size={size ?? "default"}
      className={cn(emptyVariants({ size, surface }), className)}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-xl flex-col items-center gap-2 text-center",
        className,
      )}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  "flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "size-12 rounded-xl bg-primary-muted text-primary [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      aria-hidden
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn(
        "text-title leading-tight font-bold text-foreground group-data-[size=compact]/empty:text-subtitle",
        className,
      )}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-body text-muted-foreground group-data-[size=compact]/empty:text-body-sm [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-body-sm text-balance",
        className,
      )}
      {...props}
    />
  );
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
};
