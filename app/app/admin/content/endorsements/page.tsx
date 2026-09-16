"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Box, Page, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import {
  FormActions,
  FormFields,
  FormGrid,
} from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListSkeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { optionalText, optionalWholeNumber, requiredText } from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";

type Endorsement = {
  id: string;
  rav_name: string;
  rav_title: string | null;
  image_url: string | null;
  endorsement_text: string | null;
  sort_order: number;
  is_published: boolean;
};

const endorsementSchema = z.object({
  rav_name: requiredText("שם הרב"),
  rav_title: optionalText(),
  image_url: optionalText(),
  endorsement_text: optionalText(),
  // הפקד הוא type="number", והערך שלו מחרוזת; מומר למספר בשמירה
  sort_order: optionalWholeNumber(),
  is_published: z.boolean(),
});

type EndorsementFormValues = z.infer<typeof endorsementSchema>;

const EMPTY_FORM: EndorsementFormValues = {
  rav_name: "",
  rav_title: "",
  image_url: "",
  endorsement_text: "",
  sort_order: "0",
  is_published: true,
};

export default function EndorsementsAdminPage() {
  const [items, setItems] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Callers: admin endorsements form. Storage bucket `content`. User: images for endorsements.
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  const form = useForm<EndorsementFormValues>({
    resolver: zodResolver(endorsementSchema),
    defaultValues: EMPTY_FORM,
  });

  const { isSubmitting } = form.formState;
  const imageUrl = form.watch("image_url");

  async function uploadImage(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `endorsements/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("content").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) {
      toast.error(`העלאה נכשלה: ${error.message}`);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("content").getPublicUrl(path);
    form.setValue("image_url", data.publicUrl, { shouldValidate: true });
    toast.success("התמונה הועלתה");
    setUploading(false);
  }

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
    setEditingId(item.id);
    form.reset({
      rav_name: item.rav_name,
      rav_title: item.rav_title ?? "",
      image_url: item.image_url ?? "",
      endorsement_text: item.endorsement_text ?? "",
      sort_order: String(item.sort_order),
      is_published: item.is_published,
    });
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    form.reset(EMPTY_FORM);
    setShowForm(false);
  }

  async function handleSave(values: EndorsementFormValues) {
    const payload = {
      rav_name: values.rav_name,
      rav_title: values.rav_title || null,
      image_url: values.image_url || null,
      endorsement_text: values.endorsement_text || null,
      sort_order: Number(values.sort_order) || 0,
      is_published: values.is_published,
    };

    if (editingId) {
      const { error } = await supabase
        .from("endorsements")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error(`שגיאה: ${error.message}`);
      else {
        toast.success("עודכן");
        resetForm();
        load();
      }
      return;
    }

    const { error } = await supabase.from("endorsements").insert(payload);
    if (error) toast.error(`שגיאה: ${error.message}`);
    else {
      toast.success("נוסף");
      resetForm();
      load();
    }
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
        // הטופס אינו נמתח לרוחב העמוד: שדה שם ברוחב 1200px אינו קריא.
        // הרשימה שמתחתיו נשארת ברוחב מלא.
        <Card className="w-full max-w-3xl">
          <CardContent>
            <Form {...form}>
              {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
              <form onSubmit={form.handleSubmit(handleSave)} noValidate>
                <FormFields>
                  <FormGrid>
                    <FormField
                      control={form.control}
                      name="rav_name"
                      render={({ field }) => (
                        <FormFieldShell label="שם הרב" required>
                          <Input {...field} disabled={isSubmitting} />
                        </FormFieldShell>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rav_title"
                      render={({ field }) => (
                        <FormFieldShell label="תואר / תפקיד">
                          <Input {...field} disabled={isSubmitting} />
                        </FormFieldShell>
                      )}
                    />
                  </FormGrid>

                  <div className="space-y-2">
                    <Label htmlFor="image_file">תמונת הסכמה</Label>
                    <Input
                      id="image_file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={uploading || isSubmitting}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadImage(file);
                      }}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="image_url"
                    render={({ field }) => (
                      <FormFieldShell label="או קישור לתמונה (URL)">
                        <Input
                          {...field}
                          type="url"
                          dir="ltr"
                          className="text-start"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />

                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                  ) : null}

                  <FormGrid>
                    <FormField
                      control={form.control}
                      name="sort_order"
                      render={({ field }) => (
                        <FormFieldShell label="סדר תצוגה">
                          <Input
                            {...field}
                            type="number"
                            min="0"
                            disabled={isSubmitting}
                          />
                        </FormFieldShell>
                      )}
                    />
                  </FormGrid>

                  <FormField
                    control={form.control}
                    name="endorsement_text"
                    render={({ field }) => (
                      <FormFieldShell label="טקסט ההסכמה">
                        <Textarea
                          {...field}
                          rows={4}
                          placeholder="טקסט ההסכמה של הרב (אופציונלי)"
                          disabled={isSubmitting}
                        />
                      </FormFieldShell>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_published"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormLabel className="cursor-pointer">
                          מפורסם באתר
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormActions>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                      disabled={isSubmitting}
                    >
                      ביטול
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "שומר..." : editingId ? "עדכן" : "הוסף"}
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
              <div key={item.id} className="flex items-center gap-4 py-4">
                {item.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={item.image_url}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-body-sm font-bold text-muted-foreground">
                    {item.rav_name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.rav_name}</p>
                  {item.rav_title && (
                    <p className="text-body-sm text-muted-foreground">
                      {item.rav_title}
                    </p>
                  )}
                  {item.endorsement_text && (
                    <p className="mt-1 line-clamp-2 text-body-sm text-muted-foreground">
                      {item.endorsement_text}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant={item.is_published ? "success" : "neutral"}>
                    {item.is_published ? "פורסם" : "מוסתר"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`העלאה בסדר התצוגה: ${item.rav_name}`}
                    onClick={() => moveOrder(item, "up")}
                    disabled={idx === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`הורדה בסדר התצוגה: ${item.rav_name}`}
                    onClick={() => moveOrder(item, "down")}
                    disabled={idx === items.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`עריכה: ${item.rav_name}`}
                    onClick={() => startEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    aria-label={`מחיקה: ${item.rav_name}`}
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
    </Page>
  );
}
