"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Box, Page, PageHeader } from "@/components/layout";
import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Eye, EyeOff, X, ChevronDown } from "lucide-react";

type Engagement = {
  id: string;
  groom_name: string;
  bride_name: string;
  groom_city: string | null;
  bride_city: string | null;
  shadchan_name: string | null;
  is_published: boolean;
  created_at: string;
};

const EMPTY_FORM = {
  groom_name: "",
  groom_father: "",
  groom_city: "",
  groom_yeshiva: "",
  bride_name: "",
  bride_father: "",
  bride_city: "",
  bride_seminary: "",
  shadchan_name: "",
  submitter_name: "",
  submitter_phone: "",
  submitter_email: "",
};

export default function EngagementsAdminPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("engagements")
      .select(
        "id, groom_name, bride_name, groom_city, bride_city, shadchan_name, is_published, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) toast.error("שגיאה בטעינה");
    else setEngagements(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublish(e: Engagement) {
    const newVal = !e.is_published;
    const { error } = await supabase
      .from("engagements")
      .update({ is_published: newVal })
      .eq("id", e.id);
    if (error) toast.error("שגיאה בעדכון");
    else {
      toast.success(newVal ? "פורסם" : "הוסר מפרסום");
      load();
    }
  }

  async function deleteEngagement(id: string) {
    if (!confirm("למחוק מודעה זו?")) return;
    const { error } = await supabase.from("engagements").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else {
      toast.success("נמחק");
      load();
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.groom_name.trim() || !form.bride_name.trim()) {
      toast.error("נא למלא שם חתן וכלה");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("engagements")
      .insert({ ...form, is_published: false });
    if (error) toast.error(`שגיאה: ${error.message}`);
    else {
      toast.success("מודעה נוצרה");
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    }
    setSaving(false);
  }

  const engagementColumns: DataTableColumn<Engagement>[] = [
    {
      key: "groom",
      header: "חתן",
      mobile: "title",
      className: "font-medium",
      cell: (e) => e.groom_name,
    },
    {
      key: "bride",
      header: "כלה",
      className: "font-medium",
      cell: (e) => e.bride_name,
    },
    {
      key: "cities",
      header: "ערים",
      size: "grow",
      className: "text-muted-foreground",
      cell: (e) => [e.groom_city, e.bride_city].filter(Boolean).join(" / "),
    },
    {
      key: "status",
      header: "סטטוס",
      size: "min",
      mobile: "aside",
      cell: (e) => (
        <Badge variant={e.is_published ? "success" : "warning"}>
          {e.is_published ? "מפורסם" : "ממתין"}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "תאריך",
      size: "min",
      className: "text-muted-foreground",
      cell: (e) => new Date(e.created_at).toLocaleDateString("he-IL"),
    },
    {
      key: "actions",
      header: <span className="sr-only">פעולות</span>,
      size: "min",
      mobile: "actions",
      cell: (e) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            title={e.is_published ? "הסר פרסום" : "פרסם"}
            aria-label={e.is_published ? "הסר פרסום" : "פרסם"}
            onClick={() => togglePublish(e)}
          >
            {e.is_published ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            title="מחיקה"
            aria-label="מחיקה"
            onClick={() => deleteEngagement(e.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const F = (key: keyof typeof EMPTY_FORM, label: string, type = "text") => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="mt-1"
      />
    </div>
  );

  return (
    <Page>
      <PageHeader
        title="מודעות מאורסים"
        description="אישור ופרסום שידוכים שנסגרו"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={"/app/admin/content" as any}>חזרה</Link>
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? (
                <X className="me-1 h-4 w-4" />
              ) : (
                <Plus className="me-1 h-4 w-4" />
              )}
              {showForm ? "ביטול" : "הוסף מאורסים"}
            </Button>
          </div>
        }
      />
      {showForm && (
        <Box>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <p className="font-semibold text-primary">החתן</p>
                {F("groom_name", "שם החתן *")}
                {F("groom_father", "שם אביו")}
                {F("groom_city", "עיר")}
                {F("groom_yeshiva", "מישיבת")}
              </div>
              <div className="space-y-4">
                <p className="font-semibold text-primary">הכלה</p>
                {F("bride_name", "שם הכלה *")}
                {F("bride_father", "שם אביה")}
                {F("bride_city", "עיר")}
                {F("bride_seminary", "סמינר")}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {F("shadchan_name", "שם השדכן")}
              {F("submitter_name", "שם השולח")}
              {F("submitter_phone", "טלפון", "tel")}
            </div>
            {F("submitter_email", "מייל השולח", "email")}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "שומר..." : "צור מודעה"}
              </Button>
            </div>
          </form>
        </Box>
      )}

      <Box>
        {loading ? (
          <DataTableSkeleton surface={false} />
        ) : (
          <DataTable
            surface={false}
            caption="מודעות מאורסים"
            columns={engagementColumns}
            rows={engagements}
            getRowKey={(e) => e.id}
            emptyState={
              <Empty size="compact" surface={false}>
                <EmptyHeader>
                  <EmptyTitle>אין מודעות עדיין</EmptyTitle>
                  <EmptyDescription>מודעות מהטופס באתר יופיעו כאן לאישור</EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        )}
      </Box>
    </Page>
  );
}
