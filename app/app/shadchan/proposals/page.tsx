import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { Box, Section } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { createClient } from "@/lib/supabase/server";
import {
  SHIDDUCH_STATUS_BADGE_CLASS,
  SHIDDUCH_STATUS_LABELS,
  isShidduchStatus,
  type ShidduchStatus,
} from "@/lib/shidduch-status";

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
  created_at: string;
  sent_at: string | null;
  note_for_groom: string | null;
  note_for_bride: string | null;
  groom: StudentEmbed | null;
  bride: StudentEmbed | null;
};

export default async function ShadchanProposalsPage() {
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
    note_for_groom,
    note_for_bride,
    groom:students!shidduchim_groom_id_fkey(first_name,last_name,city),
    bride:students!shidduchim_bride_id_fkey(first_name,last_name,city)
  `;

  const { data, error } = await supabase
    .from("shidduchim")
    .select(shidduchSelect)
    .eq("shadchan_id", user.id)
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  if (error) console.error(error);

  const shidduchim: ShidduchRow[] = (data || []).map((row) => ({
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    sent_at: row.sent_at,
    note_for_groom: row.note_for_groom,
    note_for_bride: row.note_for_bride,
    groom: singleEmbed(row.groom),
    bride: singleEmbed(row.bride),
  }));

  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">כל ההצעות שלך</h1>
        <Button asChild variant="outline">
          <Link href="/app/canvas">חזרה ללוח העבודה</Link>
        </Button>
      </div>

      {shidduchim.length === 0 ? (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyTitle>אין הצעות כרגע</EmptyTitle>
            <EmptyDescription>
              אין שידוכים עם סטטוס שאינו טיוטה עבור השדכן/המנהל/ת המחובר/ת.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/canvas">ליצירת הצעה חדשה</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Box className="mt-6 space-y-4">
          {shidduchim.map((row) => {
            const status: ShidduchStatus = isShidduchStatus(row.status)
              ? row.status
              : "draft";
            const note =
              row.note_for_groom?.trim() || row.note_for_bride?.trim() || null;

            return (
              <Box
                key={row.id}
                className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold">
                      {fullName(row.groom)} - {fullName(row.bride)}
                    </h2>
                    <Badge
                      variant="outline"
                      className={SHIDDUCH_STATUS_BADGE_CLASS[status]}
                    >
                      {SHIDDUCH_STATUS_LABELS[status]}
                    </Badge>
                  </div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    נוצר:{" "}
                    {new Date(row.created_at).toLocaleDateString("he-IL")}
                    {row.sent_at ? (
                      <>
                        {" "}
                        | נשלח:{" "}
                        {new Date(row.sent_at).toLocaleDateString("he-IL")}
                      </>
                    ) : null}
                  </div>

                  {note ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3">
                      {note}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-start">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/shidduchim/${row.id}`}>
                      פתיחה
                    </Link>
                  </Button>
                </div>
              </Box>
            );
          })}
        </Box>
      )}
    </Section>
  );
}

