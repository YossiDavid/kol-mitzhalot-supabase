"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { InstitutionsImportDialog } from "@/features/institutions/components/import-dialog";
import { InstitutionFormDialog } from "@/features/institutions/components/institution-form-dialog";
import { institutionColumns } from "@/features/institutions/lib/institution-columns";
import {
  EMPTY_INSTITUTION_FORM,
  institutionSchema,
  type Institution,
  type InstitutionFormState,
} from "@/features/institutions/lib/institution-form-schema";
import {
  INSTITUTION_GENDER_OPTIONS,
  INSTITUTION_TYPE_OPTIONS,
  type InstitutionGender,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";
import { createClient } from "@/lib/supabase/client";

export default function InstitutionsAdminPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState<InstitutionGender | "">("");
  const [typeFilter, setTypeFilter] = useState<InstitutionType | "">("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const supabase = createClient();

  const form = useForm<InstitutionFormState>({
    resolver: zodResolver(institutionSchema),
    defaultValues: EMPTY_INSTITUTION_FORM,
  });

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
    form.reset(EMPTY_INSTITUTION_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(institution: Institution) {
    setEditingId(institution.id);
    form.reset({
      name: institution.name,
      city: institution.city ?? "",
      gender: institution.gender,
      type: institution.type,
      is_active: institution.is_active,
    });
    setDialogOpen(true);
  }

  async function handleSave(values: InstitutionFormState) {
    const payload = {
      name: values.name,
      city: values.city || null,
      gender: values.gender,
      type: values.type,
      is_active: values.is_active,
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
      return;
    }

    toast.success(editingId ? "המוסד עודכן בהצלחה" : "המוסד נוצר בהצלחה");
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
    <Page>
      <PageHeader
        title="מוסדות לימוד"
        description="ניהול מאגר מוסדות הלימוד לבחירה באשף יצירת כרטיס מיועד"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <InstitutionsImportDialog onImported={load} />
            <Button onClick={openCreateDialog}>
              <Plus className="me-1 h-4 w-4" /> מוסד חדש
            </Button>
          </div>
        }
      />
      <Box className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <div className="w-40 space-y-2">
            <Label htmlFor="genderFilter">סינון לפי מגדר</Label>
            <NativeSelect
              id="genderFilter"
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
          <div className="w-52 space-y-2">
            <Label htmlFor="typeFilter">סינון לפי סוג מוסד</Label>
            <NativeSelect
              id="typeFilter"
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
          <DataTableSkeleton surface={false} />
        ) : (
          <DataTable
            surface={false}
            caption="מוסדות לימוד"
            columns={institutionColumns({
              onEdit: openEditDialog,
              onDelete: deleteInstitution,
            })}
            rows={filteredInstitutions}
            getRowKey={(institution) => institution.id}
            emptyState={
              <Empty size="compact" surface={false}>
                <EmptyHeader>
                  <EmptyTitle>אין מוסדות להצגה</EmptyTitle>
                  <EmptyDescription>הוסיפו מוסד ראשון למאגר</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={openCreateDialog}>
                    <Plus className="me-1 h-4 w-4" /> מוסד חדש
                  </Button>
                </EmptyContent>
              </Empty>
            }
          />
        )}
      </Box>

      <InstitutionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        editingId={editingId}
        onSubmit={handleSave}
      />
    </Page>
  );
}
