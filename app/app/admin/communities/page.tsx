"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Merge, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { DataTable, DataTableSkeleton } from "@/components/data-table";
import { Box, Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CommunityDeleteDialog } from "@/features/communities/components/community-delete-dialog";
import { CommunityFormDialog } from "@/features/communities/components/community-form-dialog";
import { CommunityMergeDialog } from "@/features/communities/components/community-merge-dialog";
import { communityColumns } from "@/features/communities/lib/community-columns";
import {
  communitySchema,
  EMPTY_COMMUNITY_FORM,
  type CommunityFormState,
  type CommunityRow,
} from "@/features/communities/lib/community-form-schema";
import {
  describeRowCount,
  loadCommunityRows,
  type CommunityMergeResult,
} from "@/features/communities/lib/community-usage";
import { createClient } from "@/lib/supabase/client";

type StatusFilter = "" | "active" | "inactive";

/** שגיאת המסד כשמנסים למחוק ערך שמופיע בכרטיסים */
const IN_USE_ERROR = "community_in_use";
/** הפרת האינדקס הייחודי על lower(btrim(name)) */
const DUPLICATE_ERROR_CODE = "23505";

export default function CommunitiesAdminPage() {
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [submitting, setSubmitting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityRow | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const form = useForm<CommunityFormState>({
    resolver: zodResolver(communitySchema),
    defaultValues: EMPTY_COMMUNITY_FORM,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCommunities(await loadCommunityRows(supabase));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "טעינת מאגר הקהילות נכשלה",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return communities.filter((community) => {
      if (statusFilter === "active" && !community.is_active) return false;
      if (statusFilter === "inactive" && community.is_active) return false;
      if (term && !community.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [communities, search, statusFilter]);

  function openCreateDialog() {
    setEditing(null);
    form.reset(EMPTY_COMMUNITY_FORM);
    setFormOpen(true);
  }

  function openEditDialog(community: CommunityRow) {
    setEditing(community);
    form.reset({ name: community.name, is_active: community.is_active });
    setFormOpen(true);
  }

  function openMergeDialog(community: CommunityRow | null) {
    setDeleteTarget(null);
    setMergeSourceId(community?.id ?? null);
    setMergeOpen(true);
  }

  async function handleSave(values: CommunityFormState) {
    const payload = { name: values.name.trim(), is_active: values.is_active };

    const { error } = editing
      ? await supabase.from("communities").update(payload).eq("id", editing.id)
      : await supabase.from("communities").insert(payload);

    if (error) {
      toast.error(
        error.code === DUPLICATE_ERROR_CODE
          ? "קהילה בשם הזה כבר קיימת במאגר"
          : `שגיאה בשמירת הקהילה: ${error.message}`,
      );
      return;
    }

    toast.success(editing ? "הקהילה עודכנה" : "הקהילה נוספה למאגר");
    setFormOpen(false);
    await load();
  }

  async function deactivate(community: CommunityRow) {
    setSubmitting(true);
    const { error } = await supabase
      .from("communities")
      .update({ is_active: false })
      .eq("id", community.id);
    setSubmitting(false);

    if (error) {
      toast.error(`שגיאה בעדכון הקהילה: ${error.message}`);
      return;
    }

    toast.success(`"${community.name}" סומנה כלא פעילה`);
    setDeleteTarget(null);
    await load();
  }

  async function deleteCommunity(community: CommunityRow) {
    setSubmitting(true);
    const { error } = await supabase
      .from("communities")
      .delete()
      .eq("id", community.id);
    setSubmitting(false);

    if (error) {
      toast.error(
        error.message === IN_USE_ERROR
          ? "אי אפשר למחוק קהילה שמופיעה בכרטיסים. אפשר לסמן אותה כלא פעילה או למזג אותה לקהילה אחרת."
          : `שגיאה במחיקת הקהילה: ${error.message}`,
      );
      return;
    }

    toast.success("הקהילה נמחקה מהמאגר");
    setDeleteTarget(null);
    await load();
  }

  async function mergeCommunities(source: CommunityRow, target: CommunityRow) {
    setSubmitting(true);
    const { data, error } = await supabase.rpc("admin_merge_communities", {
      p_source_id: source.id,
      p_target_id: target.id,
    });
    setSubmitting(false);

    if (error) {
      toast.error(`שגיאה במיזוג הקהילות: ${error.hint ?? error.message}`);
      return;
    }

    const result = data as CommunityMergeResult;
    toast.success(
      `הקהילות מוזגו: ${describeRowCount(result.rows_updated)} עודכנו`,
    );
    setMergeOpen(false);
    await load();
  }

  return (
    <Page>
      <PageHeader
        title="חסידויות וקהילות"
        count={communities.length}
        description="ניהול מאגר החסידויות והקהילות המוצע לבחירה באשף יצירת כרטיס מיועד"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => openMergeDialog(null)}>
              <Merge className="me-1 h-4 w-4" /> מיזוג כפילויות
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="me-1 h-4 w-4" /> קהילה חדשה
            </Button>
          </div>
        }
      />

      <Box className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-64 max-w-full space-y-2">
            <Label htmlFor="communitySearch">חיפוש</Label>
            <Input
              id="communitySearch"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="שם החסידות או הקהילה"
            />
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="communityStatusFilter">סינון לפי סטטוס</Label>
            <NativeSelect
              id="communityStatusFilter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <NativeSelectOption value="">הכל</NativeSelectOption>
              <NativeSelectOption value="active">פעילות</NativeSelectOption>
              <NativeSelectOption value="inactive">
                לא פעילות
              </NativeSelectOption>
            </NativeSelect>
          </div>
        </div>

        {loading ? (
          <DataTableSkeleton surface={false} />
        ) : (
          <DataTable
            surface={false}
            caption="חסידויות וקהילות"
            columns={communityColumns({
              onEdit: openEditDialog,
              onMerge: openMergeDialog,
              onDelete: setDeleteTarget,
            })}
            rows={filtered}
            getRowKey={(community) => community.id}
            initialSort={{ key: "name", direction: "asc" }}
            emptyState={
              <Empty size="compact" surface={false}>
                <EmptyHeader>
                  <EmptyTitle>אין קהילות להצגה</EmptyTitle>
                  <EmptyDescription>
                    {communities.length > 0
                      ? "אף ערך במאגר אינו תואם את החיפוש"
                      : "הוסיפו ערך ראשון למאגר"}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreateDialog}>
                    <Plus className="me-1 h-4 w-4" /> קהילה חדשה
                  </Button>
                </EmptyContent>
              </Empty>
            }
          />
        )}
      </Box>

      <CommunityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        editing={editing}
        onSubmit={handleSave}
      />

      <CommunityDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        community={deleteTarget}
        submitting={submitting}
        onConfirmDelete={deleteCommunity}
        onDeactivate={deactivate}
        onMerge={openMergeDialog}
      />

      <CommunityMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        communities={communities}
        initialSourceId={mergeSourceId}
        submitting={submitting}
        onMerge={mergeCommunities}
      />
    </Page>
  );
}
