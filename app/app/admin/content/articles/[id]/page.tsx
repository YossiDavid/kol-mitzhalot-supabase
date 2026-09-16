"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Box, Page, PageHeader, PageHeaderSkeleton } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/card-skeleton";
import { Form, FormField } from "@/components/ui/form";
import { FormFieldShell } from "@/components/ui/form-field-shell";
import { FormFields, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SkeletonRegion } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  optionalText,
  requiredText,
  requiredWholeNumber,
} from "@/lib/forms/schema";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  { value: "parents", label: "להורים" },
  { value: "singles", label: "למיועדים" },
  { value: "shadchanim", label: "לשדכנים" },
  { value: "general", label: "כללי" },
] as const;

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [
  (typeof CATEGORIES)[number]["value"],
  ...(typeof CATEGORIES)[number]["value"][],
];

/** ברירת המחדל לזמן קריאה, בדקות */
const DEFAULT_READ_TIME = "5";

const articleSchema = z.object({
  title: requiredText("כותרת"),
  slug: optionalText(),
  excerpt: requiredText("תקציר"),
  category: z.enum(CATEGORY_VALUES),
  // הפקד הוא type="number", והערך שלו מחרוזת; מומר למספר בשמירה
  read_time_minutes: requiredWholeNumber("זמן קריאה"),
  content: requiredText("תוכן המאמר"),
  is_published: z.boolean(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

export default function ArticleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string>("");
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: "",
      slug: "",
      excerpt: "",
      category: "general",
      read_time_minutes: DEFAULT_READ_TIME,
      content: "",
      is_published: false,
    },
  });

  const { isSubmitting } = form.formState;
  const isPublished = form.watch("is_published");
  const title = form.watch("title");

  useEffect(() => {
    async function load() {
      const { id: articleId } = await params;
      setId(articleId);

      if (articleId === "new") {
        setIsNew(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", articleId)
        .single();

      if (error || !data) {
        toast.error("מאמר לא נמצא");
        router.push("/app/admin/content/articles" as any);
        return;
      }

      form.reset({
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        category: data.category,
        read_time_minutes: String(data.read_time_minutes),
        content: data.content,
        is_published: data.is_published,
      });
      setLoading(false);
    }
    load();
  }, [params, router, supabase, form]);

  function generateSlug(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^֐-׿a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function save(values: ArticleFormValues, publish?: boolean) {
    const finalSlug = values.slug || generateSlug(values.title);
    const publishVal = publish !== undefined ? publish : values.is_published;

    const record = {
      title: values.title,
      slug: finalSlug,
      excerpt: values.excerpt,
      category: values.category,
      read_time_minutes: Number(values.read_time_minutes),
      content: values.content,
      is_published: publishVal,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("articles")
        .insert({
          ...record,
          published_at: publishVal ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (error) {
        toast.error(`שגיאה ביצירת מאמר: ${error.message}`);
        return;
      }
      toast.success("המאמר נוצר בהצלחה");
      router.push(`/app/admin/content/articles/${data.id}` as any);
      return;
    }

    const { error } = await supabase
      .from("articles")
      .update({
        ...record,
        published_at:
          publishVal && !values.is_published
            ? new Date().toISOString()
            : undefined,
      })
      .eq("id", id);

    if (error) {
      toast.error(`שגיאה בשמירה: ${error.message}`);
      return;
    }

    form.setValue("is_published", publishVal);
    form.setValue("slug", finalSlug);
    toast.success("נשמר בהצלחה");
  }

  /** אותה שמירה מכל כפתור: הוולידציה רצה קודם ומציגה שגיאות ליד השדות */
  const submitWith = (publish?: boolean) =>
    form.handleSubmit((values) => save(values, publish));

  if (loading) {
    return (
      <Page>
        <PageHeaderSkeleton actions={3} />
        <SkeletonRegion>
          <CardSkeleton surface="panel" header={false} fields={4} />
        </SkeletonRegion>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title={isNew ? "מאמר חדש" : "עריכת מאמר"}
        description={isNew ? "צור מאמר חדש למרכז הידע" : title}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={"/app/admin/content/articles" as any}>ביטול</Link>
            </Button>
            <Button
              variant="outline"
              onClick={submitWith(false)}
              disabled={isSubmitting}
            >
              שמור טיוטה
            </Button>
            <Button onClick={submitWith(true)} disabled={isSubmitting}>
              {isPublished ? "שמור ופרסם" : "פרסם"}
            </Button>
          </div>
        }
      />
      <Form {...form}>
        {/* noValidate: ההודעות בעברית מגיעות מהסכמה ולא מהדפדפן */}
        <form onSubmit={submitWith()} noValidate className="space-y-6">
          <Box>
            <FormFields>
              <FormGrid>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormFieldShell label="כותרת" required>
                      <Input
                        {...field}
                        placeholder="כותרת המאמר"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slug"
                  render={({ field }) => (
                    <FormFieldShell label="Slug (URL)">
                      <Input
                        {...field}
                        placeholder="נוצר אוטומטית מהכותרת"
                        className="font-mono"
                        dir="ltr"
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormFieldShell label="קטגוריה" required>
                      <NativeSelect {...field} disabled={isSubmitting}>
                        {CATEGORIES.map((c) => (
                          <NativeSelectOption key={c.value} value={c.value}>
                            {c.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </FormFieldShell>
                  )}
                />
                <FormField
                  control={form.control}
                  name="read_time_minutes"
                  render={({ field }) => (
                    <FormFieldShell label="זמן קריאה (דקות)" required>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={60}
                        disabled={isSubmitting}
                      />
                    </FormFieldShell>
                  )}
                />
              </FormGrid>

              <FormField
                control={form.control}
                name="excerpt"
                render={({ field }) => (
                  <FormFieldShell label="תקציר" required>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="תקציר קצר שיופיע בכרטיס המאמר"
                      disabled={isSubmitting}
                    />
                  </FormFieldShell>
                )}
              />
            </FormFields>
          </Box>

          <Box>
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormFieldShell label="תוכן המאמר" required isComposite>
                  <div>
                    <RichTextEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="כתוב את תוכן המאמר כאן..."
                      className="min-h-[500px]"
                    />
                  </div>
                </FormFieldShell>
              )}
            />
          </Box>

          {!isNew && (
            <Box>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">סטטוס פרסום</p>
                  <p className="text-body-sm text-muted-foreground">
                    {isPublished
                      ? "המאמר מפורסם ומוצג באתר"
                      : "המאמר בטיוטה ולא מוצג"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isPublished ? "outline" : "default"}
                  onClick={submitWith(!isPublished)}
                  disabled={isSubmitting}
                >
                  {isPublished ? "הסר מפרסום" : "פרסם עכשיו"}
                </Button>
              </div>
            </Box>
          )}
        </form>
      </Form>
    </Page>
  );
}
