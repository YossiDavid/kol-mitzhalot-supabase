import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Box, Section } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DraftActions from "@/features/shidduchim/components/draft-actions";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getSideResponses } from "@/features/shidduchim/lib/proposals-data";
import {
  SHIDDUCH_RESPONSE_BADGE_CLASS,
  SHIDDUCH_RESPONSE_LABELS,
  SHIDDUCH_SIDE_LABELS,
} from "@/features/shidduchim/lib/responses";
import {
  SHIDDUCH_STATUS_BADGE_CLASS,
  SHIDDUCH_STATUS_LABELS,
  isShidduchStatus,
  type ShidduchStatus,
} from "@/features/shidduchim/lib/status";

/** כמה שורות שידוך מסומנות בשלד הרשימה. */
const SKELETON_ROW_COUNT = 3;

type StudentEmbed = {
  first_name: string | null;
  last_name: string | null;
  city: string | null;
};

function singleEmbed(
  v: StudentEmbed | StudentEmbed[] | null | undefined,
): StudentEmbed | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function fullName(row: {
  first_name: string | null;
  last_name: string | null;
} | null) {
  const full = `${row?.first_name || ""} ${row?.last_name || ""}`.trim();
  return full || "ללא שם";
}

type ShidduchRow = {
  id: string;
  status: string;
  groom_id: string;
  bride_id: string;
  created_at: string;
  sent_at: string | null;
  note_for_groom: string | null;
  note_for_bride: string | null;
  groom: StudentEmbed | null;
  bride: StudentEmbed | null;
};

async function ShadchanProposalsList() {
  noStore();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const shidduchSelect = `
    id,
    status,
    created_at,
    sent_at,
    groom_id,
    bride_id,
    note_for_groom,
    note_for_bride,
    groom:students!shidduchim_groom_id_fkey(first_name,last_name,city),
    bride:students!shidduchim_bride_id_fkey(first_name,last_name,city)
  `;

  const { data, error } = await supabase
    .from("shidduchim")
    .select(shidduchSelect)
    .eq("shadchan_id", user.id)
    .order("created_at", { ascending: false });

  if (error) console.error(error);

  const shidduchim: ShidduchRow[] = (data || []).map((row) => ({
    id: row.id,
    groom_id: row.groom_id,
    bride_id: row.bride_id,
    status: row.status,
    created_at: row.created_at,
    sent_at: row.sent_at,
    note_for_groom: row.note_for_groom,
    note_for_bride: row.note_for_bride,
    groom: singleEmbed(row.groom),
    bride: singleEmbed(row.bride),
  }));

  // תגובות ההורים לכל ההצעות, בשאילתה אחת
  const sideResponses = await getSideResponses(
    supabase,
    shidduchim.map((row) => row.id),
  );

  if (shidduchim.length === 0) {
    return (
      <Empty className="mt-8">
        <EmptyHeader>
          <EmptyTitle>אין הצעות כרגע</EmptyTitle>
          <EmptyDescription>
            עדיין לא יצרת שידוכים. אפשר להתחיל מלוח העבודה.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/app/canvas">ליצירת הצעה חדשה</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Box className="mt-6 space-y-4">
      {shidduchim.map((row) => {
        const status: ShidduchStatus = isShidduchStatus(row.status)
          ? row.status
          : "draft";
        const note =
          row.note_for_groom?.trim() || row.note_for_bride?.trim() || null;
        const rowResponses = sideResponses.filter(
          (r) => r.shidduchId === row.id,
        );

        return (
          <Box
            key={row.id}
            className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-body font-semibold">
                  {fullName(row.groom)} - {fullName(row.bride)}
                </h2>
                <Badge
                  variant="outline"
                  className={SHIDDUCH_STATUS_BADGE_CLASS[status]}
                >
                  {SHIDDUCH_STATUS_LABELS[status]}
                </Badge>
              </div>

              <div className="mt-1 text-body-sm text-muted-foreground">
                נוצר: {new Date(row.created_at).toLocaleDateString("he-IL")}
                {row.sent_at ? (
                  <>
                    {" "}
                    | נשלח: {new Date(row.sent_at).toLocaleDateString("he-IL")}
                  </>
                ) : null}
              </div>

              {rowResponses.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {rowResponses.map((r) => (
                    <Badge
                      key={r.side}
                      variant="outline"
                      className={SHIDDUCH_RESPONSE_BADGE_CLASS[r.response]}
                    >
                      {SHIDDUCH_SIDE_LABELS[r.side]}:{" "}
                      {SHIDDUCH_RESPONSE_LABELS[r.response]}
                    </Badge>
                  ))}
                </div>
              )}

              {note ? (
                <p className="mt-2 whitespace-pre-wrap text-body-sm text-muted-foreground line-clamp-3">
                  {note}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-start">
              {status === "draft" && (
                <DraftActions
                  groomId={row.groom_id}
                  brideId={row.bride_id}
                  noteForGroom={row.note_for_groom}
                  noteForBride={row.note_for_bride}
                />
              )}
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/shidduchim/${row.id}`}>פתיחה</Link>
              </Button>
            </div>
          </Box>
        );
      })}
    </Box>
  );
}

/** שלד רשימת השידוכים, במבנה של שורת שידוך אמיתית. */
function ShadchanProposalsListSkeleton() {
  return (
    <div role="status" aria-label="טוען" className="mt-6 space-y-4">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-8 w-24 self-end sm:self-start" />
        </div>
      ))}
    </div>
  );
}

export default function ShadchanProposalsPage() {
  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-heading font-bold">כל השידוכים שלי</h1>
        <Button asChild variant="outline">
          <Link href="/app/canvas">חזרה ללוח העבודה</Link>
        </Button>
      </div>

      <Suspense fallback={<ShadchanProposalsListSkeleton />}>
        <ShadchanProposalsList />
      </Suspense>
    </Section>
  );
}
