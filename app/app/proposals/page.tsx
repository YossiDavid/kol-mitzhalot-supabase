import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Box, Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import ParentProposalListItem from "@/features/shidduchim/components/parent-proposal-list-item";
import { getMyProposals } from "@/features/shidduchim/lib/proposals-data";

/** כמה שורות הצעה מסומנות בשלד הרשימה. */
const SKELETON_PROPOSAL_COUNT = 3;

/**
 * כל ההצעות שנשלחו למשתמש כמנהל כרטיס. הרשימה מגיעה מ-
 * get_my_shidduch_proposals, שמחזירה רק הצעות שנשלחו לצד של המשתמש
 * (לפי recipient_scope), ורק את ההערה שנכתבה לצד הזה.
 */
async function ProposalsList() {
  noStore();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const proposals = await getMyProposals(supabase);

  // כדי להבחין בין "אין ילדים עדיין" ל"אין הצעות עדיין" במצב הריק
  const { count: childrenCount, error: childrenErr } =
    proposals.length === 0
      ? await supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
      : { count: null, error: null };

  if (childrenErr) {
    console.error("[proposals] children count failed", childrenErr);
  }

  const hasNoChildren =
    proposals.length === 0 && !childrenErr && childrenCount === 0;

  if (proposals.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>אין הצעות עדיין</EmptyTitle>
          <EmptyDescription>
            {hasNoChildren
              ? "כדי לקבל הצעות, צריך קודם להוסיף לפחות בן/בת אחד לרשימת הילדים."
              : "כשתגיע הצעת שידוך עבור אחד הילדים, היא תופיע כאן."}
          </EmptyDescription>
        </EmptyHeader>
        {hasNoChildren && (
          <EmptyContent>
            <Button asChild>
              <Link href="/app/students/create">להוספת בן / בת</Link>
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  return (
    <Box className="space-y-4">
      {proposals.map((proposal) => (
        <ParentProposalListItem
          key={`${proposal.shidduchId}-${proposal.side}`}
          proposal={proposal}
          showNote
        />
      ))}
    </Box>
  );
}

/** שלד רשימת ההצעות, במבנה של שורת הצעה אמיתית. */
function ProposalsListSkeleton() {
  return (
    <div role="status" aria-label="טוען" className="space-y-4">
      {Array.from({ length: SKELETON_PROPOSAL_COUNT }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-8 w-24 self-end sm:self-start" />
        </div>
      ))}
    </div>
  );
}

export default function ProposalsPage() {
  return (
    <Page>
      <PageHeader
        title="הצעות שקיבלתי"
        description="כל הצעות השידוך שנשלחו אליכם, ואפשרות להשיב לשדכן ישירות מכאן."
        actions={
          <Button asChild variant="outline">
            <Link href="/app">חזרה לאפליקציה</Link>
          </Button>
        }
      />

      <Suspense fallback={<ProposalsListSkeleton />}>
        <ProposalsList />
      </Suspense>
    </Page>
  );
}
