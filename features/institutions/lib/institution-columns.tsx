"use client";

import { Pencil, Trash2 } from "lucide-react";

import type { DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  INSTITUTION_GENDER_LABELS,
  INSTITUTION_TYPE_LABELS,
} from "@/features/institutions/lib/institution-labels";
import type { Institution } from "@/features/institutions/lib/institution-form-schema";

/** עמודות טבלת המוסדות בעמוד הניהול */
export function institutionColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (institution: Institution) => void;
  onDelete: (institution: Institution) => void;
}): DataTableColumn<Institution>[] {
  return [
    {
      key: "name",
      header: "שם המוסד",
      size: "grow",
      mobile: "title",
      className: "font-medium",
      cell: (institution) => institution.name,
    },
    {
      key: "city",
      header: "עיר",
      className: "text-muted-foreground",
      cell: (institution) => institution.city ?? "-",
    },
    {
      key: "gender",
      header: "מגדר",
      size: "min",
      className: "text-muted-foreground",
      cell: (institution) => INSTITUTION_GENDER_LABELS[institution.gender],
    },
    {
      key: "type",
      header: "סוג מוסד",
      className: "text-muted-foreground",
      cell: (institution) => INSTITUTION_TYPE_LABELS[institution.type],
    },
    {
      key: "status",
      header: "סטטוס",
      size: "min",
      mobile: "aside",
      cell: (institution) => (
        <Badge variant={institution.is_active ? "success" : "neutral"}>
          {institution.is_active ? "פעיל" : "לא פעיל"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">פעולות</span>,
      size: "min",
      mobile: "actions",
      cell: (institution) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            title="עריכה"
            aria-label={`עריכה: ${institution.name}`}
            onClick={() => onEdit(institution)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            title="מחיקה"
            aria-label={`מחיקה: ${institution.name}`}
            onClick={() => onDelete(institution)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
