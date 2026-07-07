"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/layout";
import { Box } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  parents: "להורים",
  singles: "למיועדים",
  shadchanim: "לשדכנים",
  general: "כללי",
};

type Article = {
  id: string;
  slug: string;
  title: string;
  category: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

export default function ArticlesAdminPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("articles")
      .select("id, slug, title, category, is_published, published_at, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("שגיאה בטעינת מאמרים");
    else setArticles(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function togglePublish(article: Article) {
    const newVal = !article.is_published;
    const { error } = await supabase
      .from("articles")
      .update({ is_published: newVal, published_at: newVal ? new Date().toISOString() : null })
      .eq("id", article.id);
    if (error) toast.error("שגיאה בעדכון סטטוס");
    else { toast.success(newVal ? "פורסם" : "הוסר מפרסום"); load(); }
  }

  async function deleteArticle(id: string) {
    if (!confirm("למחוק את המאמר?")) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else { toast.success("המאמר נמחק"); load(); }
  }

  return (
    <div className="space-y-10 py-4">
      <DashboardSection
        title="מאמרים"
        subTitle="ניהול מאמרי מרכז הידע"
        button={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={"/app/admin/content" as any}>חזרה</Link>
            </Button>
            <Button asChild>
              <Link href={"/app/admin/content/articles/new" as any}>
                <Plus className="me-1 h-4 w-4" /> מאמר חדש
              </Link>
            </Button>
          </div>
        }
      >
        <Box className="mt-6">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">טוען...</div>
          ) : articles.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-semibold text-muted-foreground">אין מאמרים עדיין</p>
              <p className="mt-2 text-sm text-muted-foreground">צור את המאמר הראשון</p>
              <Button asChild className="mt-6">
                <Link href={"/app/admin/content/articles/new" as any}>
                  <Plus className="me-1 h-4 w-4" /> מאמר חדש
                </Link>
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="py-2 pe-3 font-medium">כותרת</th>
                  <th className="py-2 pe-3 font-medium">קטגוריה</th>
                  <th className="py-2 pe-3 font-medium">סטטוס</th>
                  <th className="py-2 pe-3 font-medium">תאריך</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 pe-3 font-medium">{a.title}</td>
                    <td className="py-3 pe-3 text-muted-foreground">{CATEGORY_LABELS[a.category] ?? a.category}</td>
                    <td className="py-3 pe-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${a.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.is_published ? "מפורסם" : "טיוטה"}
                      </span>
                    </td>
                    <td className="py-3 pe-3 text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={a.is_published ? "הסר פרסום" : "פרסם"}
                          onClick={() => togglePublish(a)}
                        >
                          {a.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" asChild title="עריכה">
                          <Link href={`/app/admin/content/articles/${a.id}` as any}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          title="מחיקה"
                          onClick={() => deleteArticle(a.id)}
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
