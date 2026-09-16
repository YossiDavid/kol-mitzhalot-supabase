"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormActions, FormFields, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Endorsement } from "@/features/admin/lib/endorsement";
import {
  optionalText,
  optionalWholeNumber,
  requiredText,
} from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";

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

function toFormValues(editing: Endorsement | null): EndorsementFormValues {
  if (!editing) return EMPTY_FORM;
  return {
    rav_name: editing.rav_name,
    rav_title: editing.rav_title ?? "",
    image_url: editing.image_url ?? "",
    endorsement_text: editing.endorsement_text ?? "",
    sort_order: String(editing.sort_order),
    is_published: editing.is_published,
  };
}

/**
 * טופס המלצת רב (ניהול). הטופס אינו נמתח לרוחב העמוד: שדה שם ברוחב 1200px
 * אינו קריא. הרשימה שמתחתיו נשארת ברוחב מלא.
 *
 * הקורא מרנדר את הטופס עם `key` לפי הפריט הנערך, כך שהערכים ההתחלתיים
 * מתאפסים במעבר בין "הוספה" ל"עריכה".
 */
export function EndorsementForm({
  editing,
  onSaved,
  onCancel,
}: {
  editing: Endorsement | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  // Callers: admin endorsements form. Storage bucket `content`. User: images for endorsements.
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  const form = useForm<EndorsementFormValues>({
    resolver: zodResolver(endorsementSchema),
    defaultValues: toFormValues(editing),
  });

  const { isSubmitting } = form.formState;
  const imageUrl = form.watch("image_url");

  async function uploadImage(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `endorsements/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("content")
      .upload(path, file, {
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

  async function handleSave(values: EndorsementFormValues) {
    const payload = {
      rav_name: values.rav_name,
      rav_title: values.rav_title || null,
      image_url: values.image_url || null,
      endorsement_text: values.endorsement_text || null,
      sort_order: Number(values.sort_order) || 0,
      is_published: values.is_published,
    };

    if (editing) {
      const { error } = await supabase
        .from("endorsements")
        .update(payload)
        .eq("id", editing.id);
      if (error) toast.error(`שגיאה: ${error.message}`);
      else {
        toast.success("עודכן");
        onSaved();
      }
      return;
    }

    const { error } = await supabase.from("endorsements").insert(payload);
    if (error) toast.error(`שגיאה: ${error.message}`);
    else {
      toast.success("נוסף");
      onSaved();
    }
  }

  return (
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
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  ביטול
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "שומר..." : editing ? "עדכן" : "הוסף"}
                </Button>
              </FormActions>
            </FormFields>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
