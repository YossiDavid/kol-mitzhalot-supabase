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
} from "@/features/shidduchim/lib/status";

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
  shadchan_id: string;
  created_at: string;
  sent_at: string | null;
  recipient_scope: "both" | "groom_only" | "bride_only" | null;
  note_for_groom: string | null;
  note_for_bride: string | null;
  groom: { first_name: string | null; last_name: string | null; city: string | null } | null;
  bride: { first_name: string | null; last_name: string | null; city: string | null } | null;
};

export default async function ProposalsPage() {
  noStore();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  // הילדים/המיועדים ששייכים למשפחה של המשתמש
  const { data: children, error: childrenErr } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id);

  if (childrenErr) {
    // לא עוצרים את המסך במקרה של בעיית RLS/מידע; פשוט מציגים ריק
    console.error(childrenErr);
  }

  const childIds = (children || []).map((c: { id: string }) => c.id);

  if (!childIds.length) {
    return (
      <Section containerClassName="py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">כל ההצעות שלי</h1>
          <Button asChild variant="outline">
            <Link href="/app">חזרה לאפליקציה</Link>
          </Button>
        </div>

        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyTitle>אין הצעות עדיין</EmptyTitle>
            <EmptyDescription>
              כדי לקבל הצעות, צריך קודם להוסיף לפחות בן/בת אחד לרשימת
              הילדים.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/students/create">להוספת בן / בת</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Section>
    );
  }

  const shidduchSelect = `
    id,
    status,
    shadchan_id,
    created_at,
    sent_at,
    recipient_scope,
    note_for_groom,
    note_for_bride,
    groom:students!shidduchim_groom_id_fkey(first_name,last_name,city),
    bride:students!shidduchim_bride_id_fkey(first_name,last_name,city)
  `;

  const [groomRows, brideRows] = await Promise.all([
    supabase
      .from("shidduchim")
      .select(shidduchSelect)
      .in("groom_id", childIds)
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
    supabase
      .from("shidduchim")
      .select(shidduchSelect)
      .in("bride_id", childIds)
      .neq("status", "draft")
      .order("created_at", { ascending: false }),
  ]);

  const groomData = groomRows.data as ShidduchRow[] | null;
  const brideData = brideRows.data as ShidduchRow[] | null;

  const merged = new Map<string, ShidduchRow>();
  for (const row of [...(groomData || []), ...(brideData || [])]) {
    if (!row?.id) continue;
    if (!merged.has(row.id)) merged.set(row.id, row);
  }

  const shidduchim = Array.from(merged.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">כל ההצעות שלי</h1>
        <Button asChild variant="outline">
          <Link href="/app">חזרה לאפליקציה</Link>
        </Button>
      </div>

      {shidduchim.length === 0 ? (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyTitle>אין הצעות עדיין</EmptyTitle>
            <EmptyDescription>
              עדיין אין שידוכים עם סטטוס שאינו טיוטה עבור הילדים/המיועדים
              ששייכים למשפחה שלך.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/app/students">לרשימת הילדים</Link>
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

