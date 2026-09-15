"use client";

/**
 * Fact gate: callers = admin content hub link `/app/admin/content/newsletter`.
 * Affected API = PostgREST `newsletter_subscribers` select/delete.
 * Schema = public.newsletter_subscribers (email, source, created_at).
 * User instruction verbatim: "6. כרגע צריך לחבר אותו לטבלה ב db עד שנחבר אותו למסוף ניוזלטרים."
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Box, Page, PageHeader } from "@/components/layout";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Subscriber = {
  id: string;
  email: string;
  source: string;
  created_at: string;
};

export default function NewsletterAdminPage() {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("שגיאה בטעינה");
    else setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("למחוק נרשם זה?")) return;
    const { error } = await supabase
      .from("newsletter_subscribers")
      .delete()
      .eq("id", id);
    if (error) toast.error("שגיאה במחיקה");
    else {
      toast.success("נמחק");
      load();
    }
  }

  return (
    <Page>
      <PageHeader
        title="רשימת תפוצה"
        description="נרשמים מהפוטר — עד חיבור למסוף ניוזלטרים"
        actions={
          <Button asChild variant="outline">
            <Link href={"/app/admin/content" as any}>חזרה</Link>
          </Button>
        }
      />
        <Box>
          {loading ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            <Empty size="compact" surface={false}>
              <EmptyHeader>
                <EmptyTitle>אין נרשמים עדיין</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{item.email}</p>
                    <p className="text-caption text-muted-foreground">
                      {item.source} ·{" "}
                      {new Date(item.created_at).toLocaleString("he-IL")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Box>
    </Page>
  );
}
