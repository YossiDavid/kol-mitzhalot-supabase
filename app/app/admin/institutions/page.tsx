"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Box, Page, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Form, FormControl, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormFields, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { InstitutionsImportDialog } from "@/features/institutions/components/import-dialog";
import {
  INSTITUTION_GENDER_LABELS,
  INSTITUTION_GENDER_OPTIONS,
  INSTITUTION_TYPE_LABELS,
  INSTITUTION_TYPE_OPTIONS,
  type InstitutionGender,
  type InstitutionType,
} from "@/features/institutions/lib/institution-labels";
import { optionalText, requiredText } from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";

type Institution = {
  id: string;
  name: string;
  city: string | null;
  gender: InstitutionGender;
  type: InstitutionType;
  is_active: boolean;
  created_at: string;
};

const GENDER_VALUES = INSTITUTION_GENDER_OPTIONS.map((o) => o.value) as [
  InstitutionGender,
  ...InstitutionGender[],
];

const TYPE_VALUES = INSTITUTION_TYPE_OPTIONS.map((o) => o.value) as [
  InstitutionType,
  ...InstitutionType[],
];

const institutionSchema = z.object({
  name: requiredText("שם המוסד"),
  city: optionalText(),
  gender: z.enum(GENDER_VALUES),
  type: z.enum(TYPE_VALUES),
  is_active: z.boolean(),
});

type InstitutionFormState = z.infer<typeof institutionSchema>;

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

  const supabase = createClient();

  const form = useForm<InstitutionFormState>({
    resolver: zodResolver(institutionSchema),
    defaultValues: EMPTY_FORM,
  });

  const { isSubmitting } = form.formState;

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
    form.reset(EMPTY_FORM);
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

  const institutionColumns: DataTableColumn<Institution>[] = [
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
            onClick={() => openEditDialog(institution)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            title="מחיקה"
            aria-label={`מחיקה: ${institution.name}`}
            onClick={() => deleteInstitution(institution)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

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
            columns={institutionColumns}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת מוסד" : "מוסד חדש"}</DialogTitle>
            <DialogDescription>
              מוסדות אלה מוצעים לבחירה באשף יצירת כרטיס מיועד.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
            <form onSubmit={form.handleSubmit(handleSave)} noValidate>
              <FormFields>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormFieldShell label="שם המוסד" required>
                      <Input
                        {...field}
                        placeholder="לדוגמה: ישיבת אור החיים"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormFieldShell label="עיר">
                      <Input
                        {...field}
                        placeholder="לדוגמה: בני ברק"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />

                <FormGrid>
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormFieldShell label="מגדר" required>
                        <NativeSelect {...field} disabled={isSubmitting}>
                          {INSTITUTION_GENDER_OPTIONS.map((option) => (
                            <NativeSelectOption
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </FormFieldShell>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormFieldShell label="סוג מוסד" required>
                        <NativeSelect {...field} disabled={isSubmitting}>
                          {INSTITUTION_TYPE_OPTIONS.map((option) => (
                            <NativeSelectOption
                              key={option.value}
                              value={option.value}
                            >
                              {option.label}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </FormFieldShell>
                    )}
                  />
                </FormGrid>

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div>
                        <Label htmlFor="institutionActive">מוסד פעיל</Label>
                        <p className="text-body-sm text-muted-foreground">
                          מוסד לא פעיל לא יוצג לבחירה באשף יצירת כרטיס מיועד
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          id="institutionActive"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </div>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    ביטול
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "שומר..." : "שמירה"}
                  </Button>
                </DialogFooter>
              </FormFields>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
