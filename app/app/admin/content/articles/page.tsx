"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Box, Page, PageHeader } from "@/components/layout";
import {
  DataTable,
  DataTableSkeleton,
  type DataTableColumn,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
      .select(
        "id, slug, title, category, is_published, published_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) toast.error("שגיאה בטעינת מאמרים");
    else setArticles(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublish(article: Article) {
    const newVal = !article.is_published;
    const { error } = await supabase
      .from("articles")
      .update({
        is_published: newVal,
        published_at: newVal ? new Date().toISOString() : null,
      })
      .eq("id", article.id);
    if (error) toast.error("שגיאה בעדכון סטטוס");
    else {
      toast.success(newVal ? "פורסם" : "הוסר מפרסום");
      load();
    }
  }

  async function deleteArticle(id: string) {
    if (!confirm("למחוק את המאמר?")) return;
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else {
      toast.success("המאמר נמחק");
      load();
    }
  }

  const articleColumns: DataTableColumn<Article>[] = [
    {
      key: "title",
      header: "כותרת",
      size: "grow",
      mobile: "title",
      className: "font-medium",
      cell: (a) => a.title,
    },
    {
      key: "category",
      header: "קטגוריה",
      size: "min",
      className: "text-muted-foreground",
      cell: (a) => CATEGORY_LABELS[a.category] ?? a.category,
    },
    {
      key: "status",
      header: "סטטוס",
      size: "min",
      mobile: "aside",
      cell: (a) => (
        <Badge variant={a.is_published ? "success" : "neutral"}>
          {a.is_published ? "מפורסם" : "טיוטה"}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "תאריך",
      size: "min",
      className: "text-muted-foreground",
      cell: (a) => new Date(a.created_at).toLocaleDateString("he-IL"),
    },
    {
      key: "actions",
      header: <span className="sr-only">פעולות</span>,
      size: "min",
      mobile: "actions",
      cell: (a) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            title={a.is_published ? "הסר פרסום" : "פרסם"}
            aria-label={a.is_published ? "הסר פרסום" : "פרסם"}
            onClick={() => togglePublish(a)}
          >
            {a.is_published ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon" asChild title="עריכה">
            <Link
              href={`/app/admin/content/articles/${a.id}` as Route}
              aria-label={`עריכה: ${a.title}`}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            title="מחיקה"
            aria-label={`מחיקה: ${a.title}`}
            onClick={() => deleteArticle(a.id)}
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
        title="מאמרים"
        description="ניהול מאמרי מרכז הידע"
        actions={
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
      />
      <Box>
        {loading ? (
          <DataTableSkeleton surface={false} />
        ) : (
          <DataTable
            surface={false}
            caption="מאמרים"
            columns={articleColumns}
            rows={articles}
            getRowKey={(a) => a.id}
            emptyState={
              <Empty size="compact" surface={false}>
                <EmptyHeader>
                  <EmptyTitle>אין מאמרים עדיין</EmptyTitle>
                  <EmptyDescription>צור את המאמר הראשון</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild>
                    <Link href={"/app/admin/content/articles/new" as any}>
                      <Plus className="me-1 h-4 w-4" /> מאמר חדש
                    </Link>
                  </Button>
                </EmptyContent>
              </Empty>
            }
          />
        )}
      </Box>
    </Page>
  );
}
