"use client";

import { Crosshair } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ADMIN_FOCUS_LABEL } from "@/features/students/lib/card-admin-focus";

/**
 * תג "במיקוד": ההנהלה סימנה את הכרטיס להשקעה מיוחדת. ההערה (אם נכתבה)
 * מוצגת בריחוף. מוצג לשדכנים ולמנהלים בלבד - לאחרים ה-view מחזיר null.
 */
export function AdminFocusBadge({
  focusedAt,
  note,
}: {
  focusedAt: string | null | undefined;
  note?: string | null;
}) {
  if (!focusedAt) return null;
  const badge = (
    <Badge variant="warning" data-testid="admin-focus-badge">
      <Crosshair aria-hidden />
      {ADMIN_FOCUS_LABEL}
    </Badge>
  );
  if (!note) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={`${ADMIN_FOCUS_LABEL}: ${note}`}>
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>{note}</TooltipContent>
    </Tooltip>
  );
}
