"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import {
  FormActions,
  FormFields,
  FormGrid,
} from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredText,
} from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";

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

const engagementSchema = z.object({
  groom_name: requiredText("שם החתן"),
  groom_father: optionalText(),
  groom_city: optionalText(),
  groom_yeshiva: optionalText(),
  bride_name: requiredText("שם הכלה"),
  bride_father: optionalText(),
  bride_city: optionalText(),
  bride_seminary: optionalText(),
  shadchan_name: optionalText(),
  submitter_name: optionalText(),
  submitter_phone: optionalPhone(),
  submitter_email: optionalEmail(),
});

type EngagementFormValues = z.infer<typeof engagementSchema>;

const EMPTY_FORM: EngagementFormValues = {
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
  const supabase = createClient();

  const form = useForm<EngagementFormValues>({
    resolver: zodResolver(engagementSchema),
    defaultValues: EMPTY_FORM,
  });

  const { isSubmitting } = form.formState;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleCreate(values: EngagementFormValues) {
    const { error } = await supabase
      .from("engagements")
      .insert({ ...values, is_published: false });
    if (error) {
      toast.error(`שגיאה: ${error.message}`);
      return;
    }
    toast.success("מודעה נוצרה");
    form.reset(EMPTY_FORM);
    setShowForm(false);
    load();
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

  /** שדה טקסט בטופס המודעה - כולם באותה מעטפת ובאותו רוחב */
  const textField = (
    name: keyof EngagementFormValues,
    label: string,
    options: { required?: boolean; type?: string } = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormFieldShell label={label} required={options.required}>
          <Input
            {...field}
            type={options.type ?? "text"}
            disabled={isSubmitting}
          />
        </FormFieldShell>
      )}
    />
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
        // הטופס אינו נמתח לרוחב העמוד: שדות שם ברוחב מלא אינם קריאים.
        // הטבלה שמתחתיו נשארת ברוחב מלא.
        <Card className="w-full max-w-3xl">
          <CardContent>
            <Form {...form}>
              {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
              <form onSubmit={form.handleSubmit(handleCreate)} noValidate>
                <FormFields>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormFields>
                      <p className="font-semibold text-primary">החתן</p>
                      {textField("groom_name", "שם החתן", { required: true })}
                      {textField("groom_father", "שם אביו")}
                      {textField("groom_city", "עיר")}
                      {textField("groom_yeshiva", "מישיבת")}
                    </FormFields>
                    <FormFields>
                      <p className="font-semibold text-primary">הכלה</p>
                      {textField("bride_name", "שם הכלה", { required: true })}
                      {textField("bride_father", "שם אביה")}
                      {textField("bride_city", "עיר")}
                      {textField("bride_seminary", "סמינר")}
                    </FormFields>
                  </div>

                  <FormGrid columns={3}>
                    {textField("shadchan_name", "שם השדכן")}
                    {textField("submitter_name", "שם השולח")}
                    {textField("submitter_phone", "טלפון", { type: "tel" })}
                  </FormGrid>

                  {textField("submitter_email", "מייל השולח", {
                    type: "email",
                  })}

                  <FormActions>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      disabled={isSubmitting}
                    >
                      ביטול
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "שומר..." : "צור מודעה"}
                    </Button>
                  </FormActions>
                </FormFields>
              </form>
            </Form>
          </CardContent>
        </Card>
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
                  <EmptyDescription>
                    מודעות מהטופס באתר יופיעו כאן לאישור
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            }
          />
        )}
      </Box>
    </Page>
  );
}
