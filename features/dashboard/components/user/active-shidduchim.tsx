import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import ParentProposalListItem from "@/features/shidduchim/components/parent-proposal-list-item";
import type { ParentProposal } from "@/features/shidduchim/lib/proposals-data";
import { Crown } from "lucide-react";
import Link from "next/link";

export default function ActiveShidduchim({
  shiduchim,
}: {
  shiduchim: ParentProposal[];
}) {
  return (
    <>
      {shiduchim.length > 0 ? (
        <div className="space-y-3">
          {shiduchim.map((proposal) => (
            <ParentProposalListItem
              key={`${proposal.shidduchId}-${proposal.side}`}
              proposal={proposal}
            />
          ))}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>עדיין לא קיבלת הצעות משדכנים</EmptyTitle>
            <EmptyDescription>
              רוצה להצטרף למנוי פרימיום ולהבליט את המיועד/ת ברשימות השדכנים?
            </EmptyDescription>
            <Button asChild>
              <Link href="/app/premium">
                <Crown className="text-favorite fill-current" /> להצטרפות למנוי
                פרימיום
              </Link>
            </Button>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
