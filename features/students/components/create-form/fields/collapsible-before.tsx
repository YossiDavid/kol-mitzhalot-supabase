"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FULL_ROW_CLASS } from "../field-layout";

const HTML_CLASS = "space-y-2";

/**
 * פתיח עם חלק מתקפל: lead תמיד מוצג, more מאחורי כפתור "קראו עוד" (הטקסט
 * נשאר ב-DOM, מוסתר עם hidden), ו-tail תמיד מוצג. כולם HTML סטטי מהנתונים.
 */
export function CollapsibleBefore({
  lead,
  more,
  tail,
}: {
  lead: string;
  more: string;
  tail: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const moreId = useId();

  return (
    <div className={cn(FULL_ROW_CLASS, "space-y-2 [&_hr]:mt-7")}>
      <div className={HTML_CLASS} dangerouslySetInnerHTML={{ __html: lead }} />
      <div
        id={moreId}
        hidden={!isExpanded}
        className={HTML_CLASS}
        dangerouslySetInnerHTML={{ __html: more }}
      />
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0"
        aria-expanded={isExpanded}
        aria-controls={moreId}
        onClick={() => setIsExpanded((current) => !current)}
      >
        {isExpanded ? "הצג פחות" : "קראו עוד"}
      </Button>
      <div className={HTML_CLASS} dangerouslySetInnerHTML={{ __html: tail }} />
    </div>
  );
}
