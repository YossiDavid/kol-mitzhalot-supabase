"use client";

import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/data-table";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  KIND_LABELS,
  dedicationHeadline,
  type AdminDedication,
  type DedicationKind,
} from "@/features/dedications/lib/dedication-model";
import { DedicationPeriodText } from "@/features/dedications/components/dedication-period-text";
import {
  STATUS_LABELS,
  dedicationStatus,
  type DedicationStatus,
} from "@/features/dedications/lib/dedication-status";

const STATUS_VARIANTS: Record<DedicationStatus, BadgeVariant> = {
  current: "success",
  upcoming: "info",
  past: "neutral",
  unpublished: "warning",
};

interface DedicationListSectionProps {
  kind: DedicationKind;
  rows: readonly AdminDedication[];
  today: string;
  onEdit: (item: AdminDedication) => void;
  onTogglePublished: (item: AdminDedication) => void;
  onDelete: (item: AdminDedication) => void;
}

/** טבלת הקדשות מסוג אחד, בכותרת של הסוג */
export function DedicationListSection({
  kind,
  rows,
  today,
  onEdit,
  onTogglePublished,
  onDelete,
}: DedicationListSectionProps) {
  const columns: DataTableColumn<AdminDedication>[] = [
    {
      key: "text",
      header: "הקדשה",
      mobile: "title",
      size: "grow",
      className: "font-medium",
      cell: (item) => (
        <div className="space-y-0.5">
          <p>{dedicationHeadline(item.dedication_type, item.honoree)}</p>
          {item.donor_line ? (
            <p className="text-caption font-normal text-muted-foreground">
              {item.donor_line}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "period",
      header: "תקופה",
      className: "text-muted-foreground",
      cell: (item) => (
        <DedicationPeriodText startsOn={item.starts_on} endsOn={item.ends_on} />
      ),
    },
    {
      key: "status",
      header: "סטטוס",
      size: "min",
      mobile: "aside",
      cell: (item) => {
        const status = dedicationStatus(item, today);
        return (
          <Badge variant={STATUS_VARIANTS[status]}>
            {STATUS_LABELS[status]}
          </Badge>
        );
      },
    },
    {
      key: "order",
      header: "סדר",
      size: "min",
      className: "text-muted-foreground",
      cell: (item) => item.sort_order,
    },
    {
      key: "actions",
      header: <span className="sr-only">פעולות</span>,
      size: "min",
      mobile: "actions",
      cell: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`עריכה: ${item.honoree}`}
            onClick={() => onEdit(item)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${item.is_published ? "הסרה מפרסום" : "פרסום"}: ${item.honoree}`}
            onClick={() => onTogglePublished(item)}
          >
            {item.is_published ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            aria-label={`מחיקה: ${item.honoree}`}
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section
      aria-label={KIND_LABELS[kind]}
      data-testid={`dedication-group-${kind}`}
    >
      <h2 className="mb-2 text-subtitle font-bold text-primary">
        {KIND_LABELS[kind]}
        <span className="ms-2 text-body-sm font-normal text-muted-foreground">
          ({rows.length})
        </span>
      </h2>
      <DataTable
        surface={false}
        caption={KIND_LABELS[kind]}
        columns={columns}
        rows={[...rows]}
        getRowKey={(item) => item.id}
      />
    </section>
  );
}
