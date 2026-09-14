"use client";

import { Pencil, Reply } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type MessageActionsProps = {
  canEdit: boolean;
  onReply: () => void;
  onEdit: () => void;
  className?: string;
};

/**
 * כפתורי תגובה/עריכה ליד הבועה. עד כה הפעולות היו זמינות רק בתפריט
 * לחיצה ימנית ובלחיצה כפולה, ולא היה לגלות אותן. הכפתורים נחשפים
 * ב-hover, בפוקוס מקלדת ובהקשה על ההודעה (השורה מקבלת פוקוס).
 */
export function MessageActions({
  canEdit,
  onReply,
  onEdit,
  className,
}: MessageActionsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity",
        "group-hover:pointer-events-auto group-hover:opacity-100",
        "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onReply}
        aria-label="השב להודעה"
        title="השב"
        className="rounded-full text-muted-foreground hover:bg-primary-muted hover:text-primary"
      >
        <Reply className="size-4" />
      </Button>
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="עריכת ההודעה"
          title="ערוך"
          className="rounded-full text-muted-foreground hover:bg-primary-muted hover:text-primary"
        >
          <Pencil className="size-4" />
        </Button>
      )}
    </div>
  );
}
