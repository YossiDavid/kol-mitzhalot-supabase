import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookmarkCheck } from "lucide-react";

import { Section } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { createClient } from "@/lib/supabase/server";
import ShadchanProposalCard from "@/features/shidduchim/components/shadchan-proposal-card";
import ShadchanProposalListSkeleton from "@/features/shidduchim/components/shadchan-proposal-list-skeleton";
import {
  countShadchanDrafts,
  getShadchanProposals,
} from "@/features/shidduchim/components/shadchan-proposals-data";
import { getSideResponses } from "@/features/shidduchim/lib/proposals-data";

async function getCurrentUserOrNotFound() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();
  return { supabase, user };
}

/** ההצעות שנשלחו בלבד — טיוטות מוצגות בדף ההצעות השמורות */
async function ShadchanProposalsList() {
  noStore();
  const { supabase, user } = await getCurrentUserOrNotFound();

  const { proposals, failed } = await getShadchanProposals(
    supabase,
    user.id,
    "sent",
  );

  if (failed) {
    return (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyTitle>טעינת ההצעות נכשלה</EmptyTitle>
          <EmptyDescription>אפשר לנסות לרענן את הדף בעוד רגע.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (proposals.length === 0) {
    return (
      <Empty className="mt-6">
        <EmptyHeader>
          <EmptyTitle>עדיין לא נשלחו הצעות</EmptyTitle>
          <EmptyDescription>
            הצעות שתשלח לצדדים יופיעו כאן, יחד עם התגובות שלהם.
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

  // תגובות ההורים לכל ההצעות, בשאילתה אחת
  const responses = await getSideResponses(
    supabase,
    proposals.map((proposal) => proposal.id),
  );

  return (
    <ul className="mt-6 grid gap-4">
      {proposals.map((proposal) => (
        <li key={proposal.id}>
          <ShadchanProposalCard proposal={proposal} responses={responses} />
        </li>
      ))}
    </ul>
  );
}

/** קישור להצעות השמורות — מוצג רק כשיש טיוטות */
async function DraftsLink() {
  noStore();
  const { supabase, user } = await getCurrentUserOrNotFound();
  const draftsCount = await countShadchanDrafts(supabase, user.id);

  if (draftsCount === 0) return null;

  return (
    <Button asChild variant="secondary">
      <Link href="/app/shadchan/drafts">
        <BookmarkCheck aria-hidden />
        הצעות שמורות ({draftsCount})
      </Link>
    </Button>
  );
}

export default function ShadchanProposalsPage() {
  return (
    <Section containerClassName="py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-heading font-bold">כל השידוכים שלי</h1>
          <p className="mt-1 text-body-sm text-muted-foreground">
            ההצעות ששלחת לצדדים והתגובות שהתקבלו
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <DraftsLink />
          </Suspense>
          <Button asChild variant="outline">
            <Link href="/app/canvas">חזרה ללוח העבודה</Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<ShadchanProposalListSkeleton />}>
        <ShadchanProposalsList />
      </Suspense>
    </Section>
  );
}
