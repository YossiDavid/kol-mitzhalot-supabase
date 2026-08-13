"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ChevronUp, ChevronDown } from "lucide-react";

type Endorsement = {
  id: string;
  rav_name: string;
  rav_title: string | null;
  image_url: string | null;
  endorsement_text: string | null;
  sort_order: number;
  is_published: boolean;
};

const EMPTY_FORM = {
  rav_name: "",
  rav_title: "",
  image_url: "",
  endorsement_text: "",
  sort_order: 0,
  is_published: true,
};

export default function EndorsementsAdminPage() {
  const [items, setItems] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => { load(); }, []);

  function startEdit(item: Endorsement) {
    setEditingId(item.id);
    setForm({
      rav_name: item.rav_name,
      rav_title: item.rav_title ?? "",
      image_url: item.image_url ?? "",
      endorsement_text: item.endorsement_text ?? "",
      sort_order: item.sort_order,
      is_published: item.is_published,
    });
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.rav_name.trim()) { toast.error("נא למלא שם הרב"); return; }
    setSaving(true);

    const payload = {
      rav_name: form.rav_name,
      rav_title: form.rav_title || null,
      image_url: form.image_url || null,
      endorsement_text: form.endorsement_text || null,
      sort_order: form.sort_order,
      is_published: form.is_published,
    };

    if (editingId) {
      const { error } = await supabase.from("endorsements").update(payload).eq("id", editingId);
      if (error) toast.error(`שגיאה: ${error.message}`);
      else { toast.success("עודכן"); resetForm(); load(); }
    } else {
      const { error } = await supabase.from("endorsements").insert(payload);
      if (error) toast.error(`שגיאה: ${error.message}`);
      else { toast.success("נוסף"); resetForm(); load(); }
    }
    setSaving(false);
  }

  async function deleteItem(id: string) {
    if (!confirm("למחוק?")) return;
    const { error } = await supabase.from("endorsements").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else { toast.success("נמחק"); load(); }
  }

  async function moveOrder(item: Endorsement, dir: "up" | "down") {
    const idx = items.findIndex((i) => i.id === item.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const swap = items[swapIdx];
    await Promise.all([
      supabase.from("endorsements").update({ sort_order: swap.sort_order }).eq("id", item.id),
      supabase.from("endorsements").update({ sort_order: item.sort_order }).eq("id", swap.id),
    ]);
    load();
  }

  const F = (key: keyof typeof EMPTY_FORM, label: string, type = "text") => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key] as string}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="mt-1"
      />
    </div>
  );

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="המלצות רבנים"
        subTitle="הסכמות ומלצות רבני הקהילה"
        button={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={"/app/admin/content" as any}>חזרה</Link>
            </Button>
            <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
              {showForm ? <X className="me-1 h-4 w-4" /> : <Plus className="me-1 h-4 w-4" />}
              {showForm ? "ביטול" : "הוסף המלצה"}
            </Button>
          </div>
        }
      >
        {showForm && (
          <Box className="mb-6 mt-4">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {F("rav_name", "שם הרב *")}
                {F("rav_title", "תואר / תפקיד")}
                {F("image_url", "קישור לתמונה (URL)", "url")}
                <div>
                  <Label htmlFor="sort_order">סדר תצוגה</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="endorsement_text">טקסט ההסכמה</Label>
                <textarea
                  id="endorsement_text"
                  value={form.endorsement_text}
                  onChange={(e) => setForm((f) => ({ ...f, endorsement_text: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm outline-none focus:ring-2 focus:ring-ring"
                  style={{ resize: "vertical" }}
                  placeholder="טקסט ההסכמה של הרב (אופציונלי)"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_published"
                  checked={form.is_published}
                  onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                <Label htmlFor="is_published" className="cursor-pointer">מפורסם באתר</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetForm}>ביטול</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "שומר..." : editingId ? "עדכן" : "הוסף"}
                </Button>
              </div>
            </form>
          </Box>
        )}

        <Box className="mt-4">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">טוען...</div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-subtitle font-semibold text-muted-foreground">אין המלצות עדיין</p>
              <p className="mt-2 text-body-sm text-muted-foreground">הוסף המלצות רבנים שיוצגו בדף הבית</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-4 py-4">
                  {item.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.image_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-body-sm font-bold text-muted-foreground">
                      {item.rav_name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{item.rav_name}</p>
                    {item.rav_title && <p className="text-body-sm text-muted-foreground">{item.rav_title}</p>}
                    {item.endorsement_text && (
                      <p className="mt-1 text-body-sm text-muted-foreground line-clamp-2">{item.endorsement_text}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-caption font-semibold ${item.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {item.is_published ? "פורסם" : "מוסתר"}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => moveOrder(item, "up")} disabled={idx === 0}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => moveOrder(item, "down")} disabled={idx === items.length - 1}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Box>
      </DashboardSection>
    </div>
  );
}
