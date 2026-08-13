import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Custom font-size tokens (`text-display` … `text-caption`) share the `text-*`
 * namespace with color utilities (`text-primary-foreground`). Without teaching
 * tailwind-merge they are font-sizes, cn() drops the color class — e.g. black
 * text on primary buttons.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "heading",
            "title",
            "subtitle",
            "body",
            "body-sm",
            "label",
            "caption",
            "hero",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
