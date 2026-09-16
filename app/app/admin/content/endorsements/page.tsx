"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Box, Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EndorsementForm } from "@/features/admin/components/endorsement-form";
import { EndorsementRow } from "@/features/admin/components/endorsement-row";
import type { Endorsement } from "@/features/admin/lib/endorsement";
import { createClient } from "@/lib/supabase/client";

export default function EndorsementsAdminPage() {
  const [items, setItems] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Endorsement | null>(null);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("endorsements")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error("שגיאה בטעינה");
    else setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(item: Endorsement) {
    setEditing(item);
    setShowForm(true);
  }

  function resetForm() {
    setEditing(null);
    setShowForm(false);
  }

  async function deleteItem(id: string) {
    if (!confirm("למחוק?")) return;
    const { error } = await supabase.from("endorsements").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else {
      toast.success("נמחק");
      load();
    }
  }

  async function moveOrder(item: Endorsement, dir: "up" | "down") {
    const idx = items.findIndex((i) => i.id === item.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const swap = items[swapIdx];
    await Promise.all([
      supabase
        .from("endorsements")
        .update({ sort_order: swap.sort_order })
        .eq("id", item.id),
      supabase
        .from("endorsements")
        .update({ sort_order: item.sort_order })
        .eq("id", swap.id),
    ]);
    load();
  }

  return (
    <Page>
      <PageHeader
        title="המלצות רבנים"
        description="הסכמות ומלצות רבני הקהילה"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={"/app/admin/content" as any}>חזרה</Link>
            </Button>
            <Button
              onClick={() => {
                const next = !showForm;
                resetForm();
                setShowForm(next);
              }}
            >
              {showForm ? (
                <X className="me-1 h-4 w-4" />
              ) : (
                <Plus className="me-1 h-4 w-4" />
              )}
              {showForm ? "ביטול" : "הוסף המלצה"}
            </Button>
          </div>
        }
      />
      {showForm && (
        // key: מעבר בין "הוספה" לעריכת פריט מאפס את ערכי הטופס
        <EndorsementForm
          key={editing?.id ?? "new"}
          editing={editing}
          onSaved={() => {
            resetForm();
            load();
          }}
          onCancel={resetForm}
        />
      )}

      <Box>
        {loading ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <Empty size="compact" surface={false}>
            <EmptyHeader>
              <EmptyTitle>אין המלצות עדיין</EmptyTitle>
              <EmptyDescription>
                הוסף המלצות רבנים שיוצגו בדף הבית
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y">
            {items.map((item, idx) => (
              <EndorsementRow
                key={item.id}
                item={item}
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
                onMove={moveOrder}
                onEdit={startEdit}
                onDelete={deleteItem}
              />
            ))}
          </div>
        )}
      </Box>
    </Page>
  );
}
