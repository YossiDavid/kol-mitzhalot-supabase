"use client";

import { Merge, Pencil, Trash2 } from "lucide-react";

import type { DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CommunityRow } from "@/features/communities/lib/community-form-schema";
import { describeCommunityUsage } from "@/features/communities/lib/community-usage";

/** עמודות טבלת החסידויות והקהילות בעמוד הניהול */
export function communityColumns({
  onEdit,
  onMerge,
  onDelete,
}: {
  onEdit: (community: CommunityRow) => void;
  onMerge: (community: CommunityRow) => void;
  onDelete: (community: CommunityRow) => void;
}): DataTableColumn<CommunityRow>[] {
  return [
    {
      key: "name",
      header: "שם החסידות או הקהילה",
      size: "grow",
      mobile: "title",
      className: "font-medium",
      sortValue: (community) => community.name,
      cell: (community) => community.name,
    },
    {
      key: "usage",
      header: "שימוש בכרטיסים",
      size: "min",
      align: "center",
      sortValue: (community) => community.usageCount,
      // מרכוז שייך לטבלת הדסקטופ; בכרטיס המובייל הערך צמוד לתווית
      cell: (community) => (
        <div className="flex flex-col items-start gap-0.5 md:items-center">
          <span className="tabular-nums">{community.usageCount}</span>
          <span className="text-body-sm text-muted-foreground">
            {describeCommunityUsage(community)}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "סטטוס",
      size: "min",
      mobile: "aside",
      sortValue: (community) => (community.is_active ? 1 : 0),
      sortLabel: "סטטוס",
      cell: (community) => (
        <Badge variant={community.is_active ? "success" : "neutral"}>
          {community.is_active ? "פעילה" : "לא פעילה"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">פעולות</span>,
      size: "min",
      mobile: "actions",
      cell: (community) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            title="עריכה"
            aria-label={`עריכה: ${community.name}`}
            onClick={() => onEdit(community)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="מיזוג לקהילה אחרת"
            aria-label={`מיזוג: ${community.name}`}
            onClick={() => onMerge(community)}
          >
            <Merge className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            title="מחיקה"
            aria-label={`מחיקה: ${community.name}`}
            onClick={() => onDelete(community)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
