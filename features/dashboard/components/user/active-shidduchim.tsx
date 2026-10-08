import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import ParentProposalListItem from "@/features/shidduchim/components/parent-proposal-list-item";
import type { ParentProposal } from "@/features/shidduchim/lib/proposals-data";

import { SectionLoadFailed } from "../section-load-failed";

export default function ActiveShidduchim({
  shiduchim,
  failed = false,
}: {
  shiduchim: ParentProposal[];
  /** השליפה נכשלה: מציגים הודעת שגיאה ולא "אין הצעות" */
  failed?: boolean;
}) {
  if (failed) return <SectionLoadFailed title="לא הצלחנו לטעון את ההצעות" />;

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
        <Empty size="compact">
          <EmptyHeader>
            <EmptyTitle>עדיין לא קיבלת הצעות משדכנים</EmptyTitle>
            <EmptyDescription>
              רוצה להצטרף למנוי פרימיום ולהבליט את המיועד/ת ברשימות השדכנים?
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </>
  );
}
