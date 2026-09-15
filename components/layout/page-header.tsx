import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * כותרת העמוד (h1) בסגנון אחד לכל האפליקציה. לכותרת עמוד שיושבת בתוך
 * פריסה ייעודית (למשל לצד תמונה בכרטיס מיועד); בכל שאר העמודים - PageHeader.
 */
export function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-title"
      className={cn(
        "text-title leading-tight font-bold md:text-heading",
        className,
      )}
      {...props}
    />
  );
}

type PageHeaderProps = {
  title: React.ReactNode;
  /** מספר פריטים שמוצג אחרי הכותרת, למשל "(12)". 0 או חסר - לא מוצג */
  count?: number;
  description?: React.ReactNode;
  /** כפתורי פעולה. במובייל נשברים מתחת לכותרת */
  actions?: React.ReactNode;
  className?: string;
};

/** כותרת עמוד אחידה: h1 אחד, תיאור אופציונלי ופעולות */
export function PageHeader({
  title,
  count,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <PageTitle>
          {title}
          {count ? (
            <span className="ms-2 font-normal text-muted-foreground tabular-nums">
              ({count})
            </span>
          ) : null}
        </PageTitle>
        {description ? (
          <p className="text-body-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
