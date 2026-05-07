"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  SHIDDUCH_STATUS_BADGE_CLASS,
  SHIDDUCH_STATUS_LABELS,
  SHIDDUCH_STATUS_OPTIONS,
  type ShidduchStatus,
} from "@/lib/shidduch-status";

type Props = {
  shidduchId: string;
  initialStatus: ShidduchStatus;
  canEdit: boolean;
};

export default function StatusSelector({
  shidduchId,
  initialStatus,
  canEdit,
}: Props) {
  const [status, setStatus] = useState<ShidduchStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const saveStatus = (nextStatus: string) => {
    if (!canEdit) return;
    const next = nextStatus as ShidduchStatus;
    const prev = status;
    setStatus(next);

    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/shidduchim/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shidduchId,
            status: next,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus(prev);
          toast.error(data.error || "עדכון סטטוס נכשל");
          return;
        }
        toast.success("סטטוס השידוך עודכן");
        router.refresh();
      } catch {
        setStatus(prev);
        toast.error("עדכון סטטוס נכשל");
      }
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm font-medium">סטטוס</p>
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className={SHIDDUCH_STATUS_BADGE_CLASS[status]}
        >
          {SHIDDUCH_STATUS_LABELS[status]}
        </Badge>
        <div className="w-full max-w-[260px]">
          <select
            value={status}
            onChange={(e) => saveStatus(e.target.value)}
            disabled={!canEdit || isPending}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {SHIDDUCH_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
