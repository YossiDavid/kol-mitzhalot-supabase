import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Network } from "lucide-react";

import { Page, PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user-role";
import DeleteShidduchButton from "@/features/shidduchim/components/delete-shidduch-button";
import DraftActions from "@/features/shidduchim/components/draft-actions";
import ShadchanProposalCard from "@/features/shidduchim/components/shadchan-proposal-card";
import ShadchanProposalListSkeleton from "@/features/shidduchim/components/shadchan-proposal-list-skeleton";
import {
  getShadchanProposals,
  type ShadchanProposal,
} from "@/features/shidduchim/components/shadchan-proposals-data";
import { displayName } from "@/features/shidduchim/lib/responses";

const DRAFTS_URL = "/app/shadchan/drafts";

function pairLabel(proposal: ShadchanProposal): string {
  const groom = displayName(
    proposal.groom?.firstName,
    proposal.groom?.lastName,
    "ללא שם",
  );
  const bride = displayName(
    proposal.bride?.firstName,
    proposal.bride?.lastName,
    "ללא שם",
  );
  return `${groom} - ${bride}`;
}

function DraftCardActions({ proposal }: { proposal: ShadchanProposal }) {
  return (
    <>
      <DeleteShidduchButton
        shidduchId={proposal.id}
        pairLabel={pairLabel(proposal)}
        wasSent={false}
        redirectTo={DRAFTS_URL}
        variant="destructiveOutline"
      />
      <DraftActions
        groomId={proposal.groomId}
        brideId={proposal.brideId}
        noteForGroom={proposal.noteForGroom}
        noteForBride={proposal.noteForBride}
      />
    </>
  );
}

async function DraftsList() {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // כמו "כל השידוכים שלי", ובנוסף: טיוטות הן כלי עבודה של שדכן/מנהל בלבד
  if (!user || !(hasRole(user, "shadchan") || hasRole(user, "admin"))) {
    notFound();
  }

  const { proposals, failed } = await getShadchanProposals(
    supabase,
    user.id,
    "draft",
  );

  if (failed) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>טעינת ההצעות השמורות נכשלה</EmptyTitle>
          <EmptyDescription>אפשר לנסות לרענן את הדף בעוד רגע.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (proposals.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>אין הצעות שמורות</EmptyTitle>
          <EmptyDescription>
            הצעה ששומרים בלוח העבודה בלי לשלוח אותה תחכה כאן לעריכה ולשליחה.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/app/canvas">
              <Network aria-hidden />
              ללוח העבודה
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ul className="grid gap-4">
      {proposals.map((proposal) => (
        <li key={proposal.id}>
          <ShadchanProposalCard
            proposal={proposal}
            actions={<DraftCardActions proposal={proposal} />}
          />
        </li>
      ))}
    </ul>
  );
}

export default function ShadchanDraftsPage() {
  return (
    <Page>
      <PageHeader
        title="הצעות שמורות"
        description="הצעות שנשמרו וטרם נשלחו לצדדים"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/app/shadchan/proposals">כל השידוכים שלי</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/canvas">ללוח העבודה</Link>
            </Button>
          </>
        }
      />

      <Suspense fallback={<ShadchanProposalListSkeleton />}>
        <DraftsList />
      </Suspense>
    </Page>
  );
}
