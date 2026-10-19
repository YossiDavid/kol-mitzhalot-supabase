"use client";

// Importers: admin content hub Link, מייל "פנייה חדשה מהאתר" (?id=).
// API: contact_submissions CRUD via supabase client; מענה דרך
// /api/v1/admin/contact-submissions/[id]/reply.
// Schema: public.contact_submissions, public.contact_submission_replies.
// User: "3. לחבר את הטפסים למערכת הניהול ולDB." +
// "איך אני מגיב לפניות כלליות מהאתר, מתוך חלון הפנייה לפונה".

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Box, Page, PageHeader } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListSkeleton } from "@/components/ui/skeleton";
import {
  STATUS_BADGE_VARIANT,
  SubmissionDetail,
} from "@/features/admin/components/submission-detail";
import {
  FILTER_TABS,
  STATUS_LABEL,
  TYPE_LABEL,
  type Submission,
  type SubmissionFilter,
  type SubmissionStatus,
} from "@/features/contact-submissions/lib/submission-model";
import { createClient } from "@/lib/supabase/client";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SubmissionsAdminView() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SubmissionFilter>("all");
  const [selected, setSelected] = useState<Submission | null>(null);
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("id");
  const supabase = createClient();

  async function load() {
    setLoading(true);
    let query = supabase
      .from("contact_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) toast.error("שגיאה בטעינה");
    else setItems((data as Submission[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function setStatus(id: string, status: SubmissionStatus) {
    const { error } = await supabase
      .from("contact_submissions")
      .update({ status })
      .eq("id", id);
    if (error) toast.error("שגיאה בעדכון");
    else {
      toast.success("עודכן");
      setSelected((current) =>
        current?.id === id ? { ...current, status } : current,
      );
      load();
    }
  }

  function openSubmission(item: Submission) {
    setSelected(item);
    if (item.status === "new") setStatus(item.id, "read");
  }

  // קישור ישיר מהמייל למנהלים: פותח את הפנייה גם אם אינה בסינון הנוכחי
  async function openRequested(id: string) {
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("*")
      .eq("id", id)
      .maybeSingle<Submission>();
    if (error || !data) {
      toast.error("הפנייה המבוקשת לא נמצאה");
      return;
    }
    openSubmission(data);
  }

  useEffect(() => {
    if (requestedId && UUID_PATTERN.test(requestedId)) {
      openRequested(requestedId);
    }
  }, [requestedId]);

  function handleReplied(id: string) {
    setSelected((current) =>
      current?.id === id ? { ...current, status: "replied" } : current,
    );
    load();
  }

  return (
    <Page>
      <PageHeader
        title="פניות מהאתר"
        description="טפסי צור קשר ורעיונות לשידוך"
      />
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <Button
            key={tab.key}
            size="sm"
            variant={filter === tab.key ? "default" : "outline"}
            onClick={() => setFilter(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Box>
          {loading ? (
            <ListSkeleton />
          ) : items.length === 0 ? (
            <Empty size="compact" surface={false}>
              <EmptyHeader>
                <EmptyTitle>אין פניות להצגה</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full flex-col gap-1 py-4 text-start hover:bg-accent/40"
                  onClick={() => openSubmission(item)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {new Date(item.created_at).toLocaleString("he-IL")}
                    </span>
                  </div>
                  <p className="text-body-sm text-muted-foreground">
                    {TYPE_LABEL[item.type]}
                    {item.subject ? ` · ${item.subject}` : ""}
                  </p>
                  <Badge
                    variant={STATUS_BADGE_VARIANT[item.status]}
                    className="w-fit"
                  >
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </Box>

        <Box>
          {!selected ? (
            <Empty size="compact" surface={false} className="h-full min-h-48">
              <EmptyHeader>
                <EmptyDescription>בחרו פנייה לצפייה</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <SubmissionDetail
              key={selected.id}
              submission={selected}
              onSetStatus={setStatus}
              onReplied={handleReplied}
            />
          )}
        </Box>
      </div>
    </Page>
  );
}

// useSearchParams (?id= מהמייל) דורש גבול Suspense
export default function SubmissionsAdminPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SubmissionsAdminView />
    </Suspense>
  );
}
