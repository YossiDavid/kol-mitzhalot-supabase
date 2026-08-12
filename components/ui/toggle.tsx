"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "[&>svg]:stroke-2.5 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md leading-none! font-bold whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // default ≈ ghost button; on = ghost hover
        default:
          "bg-transparent text-foreground hover:bg-primary-muted hover:text-primary data-[state=on]:bg-primary-muted data-[state=on]:text-primary data-[state=on]:hover:bg-primary-muted data-[state=on]:hover:text-primary dark:hover:bg-primary-muted dark:hover:text-primary dark:data-[state=on]:bg-primary-muted dark:data-[state=on]:text-primary",
        // outline ≈ outline button; on = outline hover
        outline:
          "border border-primary bg-transparent text-primary shadow-xs hover:bg-primary-muted data-[state=on]:bg-primary-muted data-[state=on]:hover:bg-primary-muted dark:border-primary dark:bg-transparent dark:hover:bg-primary-muted dark:data-[state=on]:bg-primary-muted",
      },
      size: {
        // icon sizes from button (toggles are icon-only)
        sm: "size-7 [&>svg]:size-4",
        default: "size-9 [&>svg]:size-5",
        lg: "size-12 [&>svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
