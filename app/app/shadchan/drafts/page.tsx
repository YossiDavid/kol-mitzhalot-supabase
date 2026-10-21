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
import { ShadchanFrozenNotice } from "@/features/shadchanim/components/shadchan-frozen-notice";
import { getShadchanAccess } from "@/features/shadchanim/lib/shadchan-access";
import DeleteShidduchButton from "@/features/shidduchim/components/delete-shidduch-button";
import DraftActions from "@/features/shidduchim/components/draft-actions";
import ShadchanProposalCard from "@/features/shidduchim/components/shadchan-proposal-card";
import ShadchanProposalListSkeleton from "@/features/shidduchim/components/shadchan-proposal-list-skeleton";
import {
  getShadchanProposalsPage,
  SHADCHAN_PROPOSALS_PAGE_SIZE,
  type ShadchanProposal,
} from "@/features/shidduchim/components/shadchan-proposals-data";
import { THIRD_PARTY_PROPOSAL_MESSAGE } from "@/features/students/lib/third-party-card";
import { UrlPagination } from "@/components/url-pagination";
import { parsePageParam } from "@/lib/pagination";
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
        blockedReason={
          proposal.groom?.isProposalsPending ||
          proposal.bride?.isProposalsPending
            ? THIRD_PARTY_PROPOSAL_MESSAGE
            : null
        }
      />
    </>
  );
}

type DraftsSearchParams = Promise<{ page?: string | string[] }>;

async function DraftsList({
  searchParams,
}: {
  searchParams: DraftsSearchParams;
}) {
  noStore();
  const requestedPage = parsePageParam((await searchParams).page);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // כמו "כל השידוכים שלי", ובנוסף: טיוטות הן כלי עבודה של שדכן/מנהל בלבד
  if (!user) notFound();
  if (!hasRole(user, "admin")) {
    const shadchanAccess = await getShadchanAccess(user);
    if (shadchanAccess === "frozen") return <ShadchanFrozenNotice />;
    if (shadchanAccess === "none") notFound();
  }

  const { proposals, total, page, failed } = await getShadchanProposalsPage(
    supabase,
    user.id,
    "draft",
    requestedPage,
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
    <>
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
      <UrlPagination
        page={page}
        total={total}
        pageSize={SHADCHAN_PROPOSALS_PAGE_SIZE}
      />
    </>
  );
}

export default function ShadchanDraftsPage({
  searchParams,
}: {
  searchParams: DraftsSearchParams;
}) {
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
        <DraftsList searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}
