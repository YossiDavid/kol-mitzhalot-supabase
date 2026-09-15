import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-caption font-bold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary-hover",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        destructive:
          "border-transparent bg-destructive text-white shadow hover:bg-destructive-hover",
        outline: "border-primary bg-transparent text-primary",
        // גוונים רכים לסטטוסים: רקע בהיר וטקסט כהה מאותו גוון, במקום צבעי
        // Tailwind ישירים (bg-amber-100 וכו')
        neutral: "border-transparent bg-muted text-muted-foreground",
        info: "border-transparent bg-info-muted text-info-muted-foreground",
        success:
          "border-transparent bg-success-muted text-success-muted-foreground",
        warning:
          "border-transparent bg-warning-muted text-warning-muted-foreground",
        danger: "border-transparent bg-destructive-muted text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/** span ולא div - תג יושב בתוך טקסט, וגם בתוך <p> */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
