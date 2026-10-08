import { Suspense } from "react";

import { NotFoundHomeLink } from "@/components/not-found-home-link";

/** דף 404 גלובלי: הסבר קצר וקישור חזרה (ראו NotFoundHomeLink) */
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
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
