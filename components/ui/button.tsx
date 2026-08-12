import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "[&>svg]:stroke-2.5 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md leading-none! font-bold whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-90 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active",
        destructive:
          "bg-destructive text-white hover:bg-destructive-hover focus-visible:ring-destructive/20 active:bg-destructive-active dark:focus-visible:ring-destructive/40",
        outline:
          "border border-primary bg-transparent text-primary shadow-xs hover:bg-primary-muted active:bg-primary-muted dark:border-primary dark:bg-transparent dark:hover:bg-primary-muted dark:active:bg-primary-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-active",
        ghost:
          "bg-transparent text-foreground hover:bg-primary-muted hover:text-primary active:bg-primary-muted dark:hover:bg-primary-muted dark:hover:text-primary",
        link: "text-primary underline-offset-4 hover:text-primary-hover hover:underline",
        destructiveOutline:
          "border border-destructive/40 bg-transparent text-destructive shadow-xs hover:bg-destructive-muted focus-visible:ring-destructive/20 active:bg-destructive-muted dark:border-destructive dark:bg-transparent dark:hover:bg-destructive-muted dark:focus-visible:ring-destructive/40 dark:active:bg-destructive-muted",
      },
      size: {
        sm: "h-7 px-3 text-(length:--text-caption) [&>svg]:size-4",
        default: "h-9 px-4 text-(length:--text-body-sm) [&>svg]:size-5",
        lg: "h-12 px-6 text-(length:--text-body) [&>svg]:size-6",
        "icon-sm": "size-7 [&>svg]:size-4",
        icon: "size-9 [&>svg]:size-5",
        "icon-lg": "size-12 [&>svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
