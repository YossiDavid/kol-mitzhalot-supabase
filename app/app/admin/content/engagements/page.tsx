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
      .select("id, groom_name, bride_name, groom_city, bride_city, shadchan_name, is_published, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("שגיאה בטעינה");
    else setEngagements(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function togglePublish(e: Engagement) {
    const newVal = !e.is_published;
    const { error } = await supabase.from("engagements").update({ is_published: newVal }).eq("id", e.id);
    if (error) toast.error("שגיאה בעדכון");
    else { toast.success(newVal ? "פורסם" : "הוסר מפרסום"); load(); }
  }

  async function deleteEngagement(id: string) {
    if (!confirm("למחוק מודעה זו?")) return;
    const { error } = await supabase.from("engagements").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else { toast.success("נמחק"); load(); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.groom_name.trim() || !form.bride_name.trim()) {
      toast.error("נא למלא שם חתן וכלה");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("engagements").insert({ ...form, is_published: false });
    if (error) toast.error(`שגיאה: ${error.message}`);
    else {
      toast.success("מודעה נוצרה");
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    }
    setSaving(false);
  }

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
    <div className="space-y-10 py-4">
      <DashboardSection
        title="מודעות מאורסים"
        subTitle="אישור ופרסום שידוכים שנסגרו"
        button={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={"/app/admin/content" as any}>חזרה</Link>
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? <X className="me-1 h-4 w-4" /> : <Plus className="me-1 h-4 w-4" />}
              {showForm ? "ביטול" : "הוסף מאורסים"}
            </Button>
          </div>
        }
      >
        {showForm && (
          <Box className="mb-6 mt-4">
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <p className="font-semibold text-[#2b5a5c]">החתן</p>
                  {F("groom_name", "שם החתן *")}
                  {F("groom_father", "שם אביו")}
                  {F("groom_city", "עיר")}
                  {F("groom_yeshiva", "מישיבת")}
                </div>
                <div className="space-y-4">
                  <p className="font-semibold text-[#2b5a5c]">הכלה</p>
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
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>ביטול</Button>
                <Button type="submit" disabled={saving}>{saving ? "שומר..." : "צור מודעה"}</Button>
              </div>
            </form>
          </Box>
        )}

        <Box className="mt-4">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">טוען...</div>
          ) : engagements.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-semibold text-muted-foreground">אין מודעות עדיין</p>
              <p className="mt-2 text-sm text-muted-foreground">מודעות מהטופס באתר יופיעו כאן לאישור</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">חתן</th>
                  <th className="py-2 pe-3 font-medium">כלה</th>
                  <th className="py-2 pe-3 font-medium">ערים</th>
                  <th className="py-2 pe-3 font-medium">סטטוס</th>
                  <th className="py-2 pe-3 font-medium">תאריך</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {engagements.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 pe-3 font-medium">{e.groom_name}</td>
                    <td className="py-3 pe-3 font-medium">{e.bride_name}</td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {[e.groom_city, e.bride_city].filter(Boolean).join(" / ")}
                    </td>
                    <td className="py-3 pe-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${e.is_published ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {e.is_published ? "מפורסם" : "ממתין"}
                      </span>
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={e.is_published ? "הסר פרסום" : "פרסם"}
                          onClick={() => togglePublish(e)}
                        >
                          {e.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          title="מחיקה"
                          onClick={() => deleteEngagement(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Box>
      </DashboardSection>
    </div>
  );
}
