"use client";

import { Plus, Tag, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  deleteDedication,
  setDedicationPublished,
} from "@/app/app/admin/content/dedications/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Box, Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ListSkeleton } from "@/components/ui/skeleton";
import { DedicationForm } from "@/features/dedications/components/dedication-form";
import { DedicationListSection } from "@/features/dedications/components/dedication-list-section";
import { DedicationPricesForm } from "@/features/dedications/components/dedication-prices-form";
import {
  toDedicationPrices,
  type DedicationPrices,
} from "@/features/dedications/lib/dedication-prices";
import { DedicationPricesSummary } from "@/features/dedications/components/dedication-prices-summary";
import {
  DEDICATION_KINDS,
  KIND_LABELS,
  compareDedications,
  type AdminDedication,
  type DedicationKind,
} from "@/features/dedications/lib/dedication-model";
import {
  STATUS_LABELS,
  dedicationStatus,
  type DedicationStatus,
} from "@/features/dedications/lib/dedication-status";
import { israelDateOf } from "@/features/dedications/lib/israel-date";
import { createClient } from "@/lib/supabase/client";

const ALL = "all";
const STATUS_ORDER: readonly DedicationStatus[] = [
  "current",
  "upcoming",
  "past",
  "unpublished",
];
/** סדר הקבוצות ברשימה: החודש הגדול ראשון, כמו באתר */
const KIND_DISPLAY_ORDER: readonly DedicationKind[] = [
  "sponsor_month",
  "sponsor_week",
  "sponsor_day",
  "memorial",
];

export default function DedicationsAdminPage() {
  const [items, setItems] = useState<AdminDedication[]>([]);
  const [prices, setPrices] = useState<DedicationPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // טופס המחירים וטופס ההקדשה לא פתוחים יחד
  const [showPrices, setShowPrices] = useState(false);
  const [editing, setEditing] = useState<AdminDedication | null>(null);
  const [deleting, setDeleting] = useState<AdminDedication | null>(null);
  const [kindFilter, setKindFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const today = israelDateOf(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    // כתיבה רק בפעולות השרת; הקריאה ישירה, ו-RLS מאפשר למנהל לראות הכול
    const supabase = createClient();
    const [dedications, priceRows] = await Promise.all([
      supabase
        .from("dedications")
        .select(
          "id, kind, dedication_type, honoree, donor_line, note, starts_on, ends_on, sort_order, is_published, donation_id, needs_review",
        ),
      supabase.from("dedication_prices").select("kind, amount"),
    ]);
    if (dedications.error || priceRows.error) toast.error("שגיאה בטעינה");
    if (!dedications.error) {
      setItems((dedications.data ?? []) as AdminDedication[]);
    }
    if (!priceRows.error) setPrices(toDedicationPrices(priceRows.data ?? []));
    setLoading(false);
  }, []);

  useEffect(() => {
    // טעינה ראשונית מהמסד (אותו דפוס כמו עמוד המלצות הרבנים)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (kindFilter === ALL || item.kind === kindFilter) &&
          (statusFilter === ALL ||
            dedicationStatus(item, today) === statusFilter),
      ),
    [items, kindFilter, statusFilter, today],
  );

  function resetForm() {
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(item: AdminDedication) {
    setShowPrices(false);
    setEditing(item);
    setShowForm(true);
  }

  async function togglePublished(item: AdminDedication) {
    const result = await setDedicationPublished(item.id, !item.is_published);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(item.is_published ? "הוסרה מפרסום" : "פורסמה");
    void load();
  }

  async function confirmDelete(): Promise<boolean> {
    if (!deleting) return false;
    const result = await deleteDedication(deleting.id);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    toast.success("נמחקה");
    return true;
  }

  return (
    <Page>
      <PageHeader
        title="הקדשות והנצחות"
        description="קוביות פרנס היום, השבוע והחודש והנצחות, כפי שמוצגות בדף הבית ובדף התרומות. קובייה מוצגת רק בתקופתה"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              aria-expanded={showPrices}
              onClick={() => {
                resetForm();
                setShowPrices((current) => !current);
              }}
            >
              <Tag className="me-1 h-4 w-4" />
              מחירי פרנס
            </Button>
            <Button
              onClick={() => {
                const next = !showForm;
                resetForm();
                setShowPrices(false);
                setShowForm(next);
              }}
            >
              {showForm ? (
                <X className="me-1 h-4 w-4" />
              ) : (
                <Plus className="me-1 h-4 w-4" />
              )}
              {showForm ? "ביטול" : "הוסף הקדשה"}
            </Button>
          </div>
        }
      />

      {prices && !showPrices ? (
        <DedicationPricesSummary prices={prices} />
      ) : null}

      {prices && showPrices && (
        // key: אחרי טעינה מחדש הטופס מתחיל מהמחירים השמורים
        <DedicationPricesForm
          key={JSON.stringify(prices)}
          prices={prices}
          onSaved={() => {
            setShowPrices(false);
            void load();
          }}
        />
      )}

      {showForm && (
        // key: מעבר בין "הוספה" לעריכת פריט מאפס את ערכי הטופס
        <DedicationForm
          key={editing?.id ?? "new"}
          editing={editing}
          existing={items}
          onSaved={() => {
            resetForm();
            void load();
          }}
          onCancel={resetForm}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-body-sm">
          סוג
          <NativeSelect
            size="sm"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            aria-label="סינון לפי סוג"
          >
            <NativeSelectOption value={ALL}>הכול</NativeSelectOption>
            {DEDICATION_KINDS.map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex items-center gap-2 text-body-sm">
          סטטוס
          <NativeSelect
            size="sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="סינון לפי סטטוס"
          >
            <NativeSelectOption value={ALL}>הכול</NativeSelectOption>
            {STATUS_ORDER.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {STATUS_LABELS[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>

      <Box>
        {loading ? (
          <ListSkeleton />
        ) : visible.length === 0 ? (
          <Empty size="compact" surface={false}>
            <EmptyHeader>
              <EmptyTitle>אין הקדשות להצגה</EmptyTitle>
              <EmptyDescription>
                הוסף הקדשה ראשונה, או שנה את הסינון
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-10">
            {KIND_DISPLAY_ORDER.map((kind) => {
              const rows = visible
                .filter((item) => item.kind === kind)
                .sort(compareDedications);
              if (rows.length === 0) return null;
              return (
                <DedicationListSection
                  key={kind}
                  kind={kind}
                  rows={rows}
                  today={today}
                  onEdit={startEdit}
                  onTogglePublished={togglePublished}
                  onDelete={setDeleting}
                />
              );
            })}
          </div>
        )}
      </Box>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="מחיקת הקדשה"
        description={
          deleting
            ? `למחוק את ההקדשה "${deleting.honoree}"? הפעולה אינה הפיכה.`
            : ""
        }
        confirmLabel="מחק"
        pendingLabel="מוחק..."
        onConfirm={confirmDelete}
        onSuccess={() => {
          setDeleting(null);
          void load();
        }}
        onError={() => toast.error("המחיקה נכשלה. נסו שוב")}
      />
    </Page>
  );
}
