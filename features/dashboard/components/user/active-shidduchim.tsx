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
  recentlyClosed = [],
  failed = false,
}: {
  shiduchim: ParentProposal[];
  /** נסגרו ב-30 הימים האחרונים - כדי שהצעה שנדחתה לא תיעלם בלי הסבר */
  recentlyClosed?: ParentProposal[];
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
      ) : recentlyClosed.length > 0 ? (
        <p className="text-body-sm text-muted-foreground">
          אין כרגע הצעות פתוחות.
        </p>
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
      {recentlyClosed.length > 0 && (
        <section
          aria-labelledby="recently-closed-proposals"
          className="mt-5 space-y-3"
          data-testid="recently-closed-proposals"
        >
          <h4
            id="recently-closed-proposals"
            className="text-body-sm font-bold text-muted-foreground"
          >
            הצעות שנסגרו לאחרונה
          </h4>
          {recentlyClosed.map((proposal) => (
            <ParentProposalListItem
              key={`${proposal.shidduchId}-${proposal.side}`}
              proposal={proposal}
            />
          ))}
        </section>
      )}
    </>
  );
}
