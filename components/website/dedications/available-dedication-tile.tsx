import type { Route } from "next";
import Link from "next/link";

import {
  AVAILABLE_HEADLINE,
  AVAILABLE_SHELL,
  TILE_BASE,
} from "@/components/website/dedications/dedication-tile-styles";
import { Button } from "@/components/ui/button";
import {
  AVAILABLE_SLOT_CTA,
  AVAILABLE_SLOT_TEXT,
  KIND_LABELS,
  type SponsorKind,
} from "@/features/dedications/lib/dedication-model";
import { cn } from "@/lib/utils";

interface AvailableDedicationTileProps {
  kind: SponsorKind;
  /** יעד ההזמנה: טופס התרומה (בדף התרומות עצמו: עוגן באותו עמוד) */
  donateHref: string;
}

/** משבצת פנויה: במקום חור בעמוד, הזמנה להקדיש את היום / השבוע / החודש */
export function AvailableDedicationTile({
  kind,
  donateHref,
}: AvailableDedicationTileProps) {
  return (
    <article
      className={cn(TILE_BASE, AVAILABLE_SHELL[kind])}
      data-kind={kind}
      data-testid={`dedication-available-${kind}`}
    >
      <h3 className="text-caption font-bold tracking-[0.08em] text-primary">
        {KIND_LABELS[kind]}
      </h3>
      <p className={cn("leading-snug text-balance", AVAILABLE_HEADLINE[kind])}>
        {AVAILABLE_SLOT_TEXT[kind]}
      </p>
      <div>
        <Button
          asChild
          variant="outline"
          size={kind === "sponsor_day" ? "default" : "lg"}
        >
          <Link href={donateHref as Route}>{AVAILABLE_SLOT_CTA[kind]}</Link>
        </Button>
      </div>
    </article>
  );
}
