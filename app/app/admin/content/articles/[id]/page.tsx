"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "parents", label: "להורים" },
  { value: "singles", label: "למיועדים" },
  { value: "shadchanim", label: "לשדכנים" },
  { value: "general", label: "כללי" },
];

export default function ArticleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string>("");
  const [isNew, setIsNew] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState("general");
  const [readTime, setReadTime] = useState(5);
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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

      setTitle(data.title);
      setSlug(data.slug);
      setExcerpt(data.excerpt);
      setCategory(data.category);
      setReadTime(data.read_time_minutes);
      setContent(data.content);
      setIsPublished(data.is_published);
      setLoading(false);
    }
    load();
  }, [params, router, supabase]);

  function generateSlug(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^֐-׿a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  async function handleSave(publish?: boolean) {
    if (!title.trim() || !excerpt.trim() || !content.trim()) {
      toast.error("נא למלא כותרת, תקציר ותוכן");
      return;
    }
    const finalSlug = slug || generateSlug(title);
    const publishVal = publish !== undefined ? publish : isPublished;

    setSaving(true);

    if (isNew) {
      const { data, error } = await supabase
        .from("articles")
        .insert({
          title,
          slug: finalSlug,
          excerpt,
          category,
          read_time_minutes: readTime,
          content,
          is_published: publishVal,
          published_at: publishVal ? new Date().toISOString() : null,
        })
        .select("id")
        .single();

      if (error) {
        toast.error(`שגיאה ביצירת מאמר: ${error.message}`);
      } else {
        toast.success("המאמר נוצר בהצלחה");
        router.push(`/app/admin/content/articles/${data.id}` as any);
      }
    } else {
      const { error } = await supabase
        .from("articles")
        .update({
          title,
          slug: finalSlug,
          excerpt,
          category,
          read_time_minutes: readTime,
          content,
          is_published: publishVal,
          published_at: publishVal && !isPublished ? new Date().toISOString() : undefined,
        })
        .eq("id", id);

      if (error) {
        toast.error(`שגיאה בשמירה: ${error.message}`);
      } else {
        setIsPublished(publishVal);
        setSlug(finalSlug);
        toast.success("נשמר בהצלחה");
      }
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-10 py-4">
        <DashboardSection title="טוען..." subTitle="" button={<Button disabled>שמירה</Button>}>
          <div className="py-10 text-center">טוען...</div>
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title={isNew ? "מאמר חדש" : "עריכת מאמר"}
        subTitle={isNew ? "צור מאמר חדש למרכז הידע" : title}
        button={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={"/app/admin/content/articles" as any}>ביטול</Link>
            </Button>
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              שמור טיוטה
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving}>
              {isPublished ? "שמור ופרסם" : "פרסם"}
            </Button>
          </div>
        }
      >
        <div className="mt-6 space-y-6">
          <Box className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">כותרת *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="כותרת המאמר"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="נוצר אוטומטית מהכותרת"
                  className="mt-1 font-mono text-body-sm"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="category">קטגוריה *</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="readTime">זמן קריאה (דקות)</Label>
                <Input
                  id="readTime"
                  type="number"
                  min={1}
                  max={60}
                  value={readTime}
                  onChange={(e) => setReadTime(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="excerpt">תקציר *</Label>
              <textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="תקציר קצר שיופיע בכרטיס המאמר"
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm outline-none focus:ring-2 focus:ring-ring"
                style={{ resize: "vertical" }}
              />
            </div>
          </Box>

          <Box>
            <Label>תוכן המאמר *</Label>
            <div className="mt-2">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="כתוב את תוכן המאמר כאן..."
                className="min-h-[500px]"
              />
            </div>
          </Box>

          {!isNew && (
            <Box>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">סטטוס פרסום</p>
                  <p className="text-body-sm text-muted-foreground">
                    {isPublished ? "המאמר מפורסם ומוצג באתר" : "המאמר בטיוטה ולא מוצג"}
                  </p>
                </div>
                <Button
                  variant={isPublished ? "outline" : "default"}
                  onClick={() => handleSave(!isPublished)}
                  disabled={saving}
                >
                  {isPublished ? "הסר מפרסום" : "פרסם עכשיו"}
                </Button>
              </div>
            </Box>
          )}
        </div>
      </DashboardSection>
    </div>
  );
}
