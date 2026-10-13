"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DedicationTile } from "@/components/website/dedications/dedication-tile";
import type { PublicDedication } from "@/features/dedications/lib/dedication-model";

/** כמה הנצחות מוצגות לפני "הצג עוד" */
const MEMORIALS_COLLAPSED_COUNT = 8;

/** רשת הנצחות אחידות וקטנות. מעל התקרה: כפתור "הצג את כל ההנצחות" */
export function MemorialGrid({
  items,
}: {
  items: readonly PublicDedication[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMore = items.length > MEMORIALS_COLLAPSED_COUNT;
  const visible =
    isExpanded || !hasMore ? items : items.slice(0, MEMORIALS_COLLAPSED_COUNT);

  return (
    <div>
      <ul
        id="memorials-list"
        className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4"
      >
        {visible.map((item) => (
          <li key={item.id}>
            <DedicationTile
              kind="memorial"
              dedicationType={item.dedication_type}
              honoree={item.honoree}
              donorLine={item.donor_line}
              note={item.note}
              startsOn={item.starts_on}
              endsOn={item.ends_on}
            />
          </li>
        ))}
      </ul>
      {hasMore ? (
        <div className="mt-6 text-center">
          <Button
            type="button"
            variant="outline"
            aria-expanded={isExpanded}
            aria-controls="memorials-list"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "הצג פחות" : `לכל ההנצחות (${items.length})`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
