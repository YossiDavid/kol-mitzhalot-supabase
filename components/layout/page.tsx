import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * רוחב תוכן העמוד בתוך המיכל של app/app/layout.tsx.
 * full - כל הרוחב; content - תוכן לקריאה (פרופיל); form - טופס בעמודה אחת.
 */
const PAGE_WIDTH_CLASS = {
  full: "",
  content: "mx-auto w-full max-w-3xl",
  form: "mx-auto w-full max-w-2xl",
} as const;

export type PageWidth = keyof typeof PAGE_WIDTH_CLASS;

type PageProps = React.ComponentProps<"div"> & {
  width?: PageWidth;
};

/**
 * עטיפת עמוד אחידה: מרווח קבוע בין הכותרת לבין מקטעי העמוד. המיכל והריפוד
 * הצדדי כבר מגיעים מה-layout, ולכן אין כאן container נוסף.
 */
export function Page({ width = "full", className, ...props }: PageProps) {
  return (
    <div
      data-slot="page"
      className={cn(
        "flex flex-col gap-6 py-2 md:py-4",
        PAGE_WIDTH_CLASS[width],
        className,
      )}
      {...props}
    />
  );
}
