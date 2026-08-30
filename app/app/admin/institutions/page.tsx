"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  INSTITUTION_GENDER_LABELS,
  INSTITUTION_GENDER_OPTIONS,
  INSTITUTION_TYPE_LABELS,
  INSTITUTION_TYPE_OPTIONS,
  type InstitutionGender,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";

type Institution = {
  id: string;
  name: string;
  city: string | null;
  gender: InstitutionGender;
  type: InstitutionType;
  is_active: boolean;
  created_at: string;
};

type InstitutionFormState = {
  name: string;
  city: string;
  gender: InstitutionGender;
  type: InstitutionType;
  is_active: boolean;
};

const EMPTY_FORM: InstitutionFormState = {
  name: "",
  city: "",
  gender: "male",
  type: "yeshiva_gedola",
  is_active: true,
};

export default function InstitutionsAdminPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<InstitutionGender | "">("");
  const [typeFilter, setTypeFilter] = useState<InstitutionType | "">("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstitutionFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("institutions")
      .select("id, name, city, gender, type, is_active, created_at")
      .order("name", { ascending: true });
    if (error) {
      toast.error(`שגיאה בטעינת מוסדות: ${error.message}`);
    } else {
      setInstitutions(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredInstitutions = useMemo(() => {
    return institutions.filter((institution) => {
      if (genderFilter && institution.gender !== genderFilter) return false;
      if (typeFilter && institution.type !== typeFilter) return false;
      return true;
    });
  }, [institutions, genderFilter, typeFilter]);

  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(institution: Institution) {
    setEditingId(institution.id);
    setForm({
      name: institution.name,
      city: institution.city ?? "",
      gender: institution.gender,
      type: institution.type,
      is_active: institution.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("נא למלא שם מוסד");
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      city: form.city.trim() || null,
      gender: form.gender,
      type: form.type,
      is_active: form.is_active,
    };

    const { error } = editingId
      ? await supabase.from("institutions").update(payload).eq("id", editingId)
      : await supabase.from("institutions").insert(payload);

    if (error) {
      toast.error(
        error.code === "23505"
          ? "מוסד עם אותו שם, עיר ומגדר כבר קיים במאגר"
          : `שגיאה בשמירת המוסד: ${error.message}`,
      );
      setSaving(false);
      return;
    }

    toast.success(editingId ? "המוסד עודכן בהצלחה" : "המוסד נוצר בהצלחה");
    setSaving(false);
    setDialogOpen(false);
    load();
  }

  async function deleteInstitution(institution: Institution) {
    const confirmed = confirm(
      `למחוק את המוסד "${institution.name}"? מיועדים המשויכים למוסד זה יאבדו את שיוך המוסד שלהם (השדה יתאפס), אך הכרטיסים שלהם לא יימחקו.`,
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("institutions")
      .delete()
      .eq("id", institution.id);
    if (error) {
      toast.error(`שגיאה במחיקת המוסד: ${error.message}`);
      return;
    }
    toast.success("המוסד נמחק");
    load();
  }

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="מוסדות לימוד"
        subTitle="ניהול מאגר מוסדות הלימוד לבחירה באשף יצירת כרטיס מיועד"
        button={
          <Button onClick={openCreateDialog}>
            <Plus className="me-1 h-4 w-4" /> מוסד חדש
          </Button>
        }
      >
        <Box className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="w-40">
              <Label htmlFor="genderFilter">סינון לפי מגדר</Label>
              <NativeSelect
                id="genderFilter"
                className="mt-1"
                value={genderFilter}
                onChange={(e) =>
                  setGenderFilter(e.target.value as InstitutionGender | "")
                }
              >
                <NativeSelectOption value="">הכל</NativeSelectOption>
                {INSTITUTION_GENDER_OPTIONS.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="w-52">
              <Label htmlFor="typeFilter">סינון לפי סוג מוסד</Label>
              <NativeSelect
                id="typeFilter"
                className="mt-1"
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as InstitutionType | "")
                }
              >
                <NativeSelectOption value="">הכל</NativeSelectOption>
                {INSTITUTION_TYPE_OPTIONS.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              טוען...
            </div>
          ) : filteredInstitutions.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-subtitle font-semibold text-muted-foreground">
                אין מוסדות להצגה
              </p>
              <p className="mt-2 text-body-sm text-muted-foreground">
                הוסיפו מוסד ראשון למאגר
              </p>
              <Button className="mt-6" onClick={openCreateDialog}>
                <Plus className="me-1 h-4 w-4" /> מוסד חדש
              </Button>
            </div>
          ) : (
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">שם המוסד</th>
                  <th className="py-2 pe-3 font-medium">עיר</th>
                  <th className="py-2 pe-3 font-medium">מגדר</th>
                  <th className="py-2 pe-3 font-medium">סוג מוסד</th>
                  <th className="py-2 pe-3 font-medium">סטטוס</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredInstitutions.map((institution) => (
                  <tr
                    key={institution.id}
                    className="border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="py-3 pe-3 font-medium">
                      {institution.name}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {institution.city ?? "-"}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {INSTITUTION_GENDER_LABELS[institution.gender]}
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {INSTITUTION_TYPE_LABELS[institution.type]}
                    </td>
                    <td className="py-3 pe-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-semibold ${
                          institution.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {institution.is_active ? "פעיל" : "לא פעיל"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="עריכה"
                          onClick={() => openEditDialog(institution)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          title="מחיקה"
                          onClick={() => deleteInstitution(institution)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת מוסד" : "מוסד חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="institutionName">שם המוסד *</Label>
              <Input
                id="institutionName"
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="לדוגמה: ישיבת אור החיים"
              />
            </div>

            <div>
              <Label htmlFor="institutionCity">עיר</Label>
              <Input
                id="institutionCity"
                className="mt-1"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="לדוגמה: בני ברק"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="institutionGender">מגדר *</Label>
                <NativeSelect
                  id="institutionGender"
                  className="mt-1"
                  value={form.gender}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      gender: e.target.value as InstitutionGender,
                    })
                  }
                >
                  {INSTITUTION_GENDER_OPTIONS.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor="institutionType">סוג מוסד *</Label>
                <NativeSelect
                  id="institutionType"
                  className="mt-1"
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as InstitutionType,
                    })
                  }
                >
                  {INSTITUTION_TYPE_OPTIONS.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">מוסד פעיל</p>
                <p className="text-body-sm text-muted-foreground">
                  מוסד לא פעיל לא יוצג לבחירה באשף יצירת כרטיס מיועד
                </p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "שומר..." : "שמירה"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
