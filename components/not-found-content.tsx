import { Suspense } from "react";

import { NotFoundHomeLink } from "@/components/not-found-home-link";
import { cn } from "@/lib/utils";

/** תוכן דף 404: הסבר קצר וקישור חזרה. משותף ל-404 הגלובלי ול-404 שבתוך האפליקציה */
export function NotFoundContent({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 text-center",
        className,
      )}
    >
      <h1 className="text-display font-bold">404</h1>
      <p className="text-subtitle">הדף שחיפשת לא נמצא</p>
      <p className="text-body-sm text-muted-foreground">
        ייתכן שהקישור שגוי, או שהדף הוסר.
      </p>
      <Suspense fallback={null}>
        <NotFoundHomeLink />
      </Suspense>
    </div>
  );
}
