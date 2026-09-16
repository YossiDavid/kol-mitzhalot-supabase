"use client";

import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Endorsement } from "@/features/admin/lib/endorsement";

/** שורה ברשימת המלצות הרבנים (ניהול) */
export function EndorsementRow({
  item,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onDelete,
}: {
  item: Endorsement;
  isFirst: boolean;
  isLast: boolean;
  onMove: (item: Endorsement, dir: "up" | "down") => void;
  onEdit: (item: Endorsement) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-4">
      {item.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={item.image_url}
          alt=""
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-body-sm font-bold text-muted-foreground">
          {item.rav_name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.rav_name}</p>
        {item.rav_title && (
          <p className="text-body-sm text-muted-foreground">{item.rav_title}</p>
        )}
        {item.endorsement_text && (
          <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">
            {item.endorsement_text}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge variant={item.is_published ? "success" : "neutral"}>
          {item.is_published ? "פורסם" : "מוסתר"}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`העלאה בסדר התצוגה: ${item.rav_name}`}
          onClick={() => onMove(item, "up")}
          disabled={isFirst}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`הורדה בסדר התצוגה: ${item.rav_name}`}
          onClick={() => onMove(item, "down")}
          disabled={isLast}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`עריכה: ${item.rav_name}`}
          onClick={() => onEdit(item)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={`מחיקה: ${item.rav_name}`}
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
