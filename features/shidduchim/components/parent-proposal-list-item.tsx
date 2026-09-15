import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ProposalResponseDialog from "@/features/shidduchim/components/proposal-response-dialog";
import type { ParentProposal } from "@/features/shidduchim/lib/proposals-data";
import {
  SHIDDUCH_RESPONSE_BADGE_VARIANT,
  SHIDDUCH_RESPONSE_LABELS,
  canRespondToProposal,
  displayName,
  formatDate,
} from "@/features/shidduchim/lib/responses";
import {
  SHIDDUCH_STATUS_BADGE_VARIANT,
  SHIDDUCH_STATUS_LABELS,
} from "@/features/shidduchim/lib/status";

type ParentProposalListItemProps = {
  proposal: ParentProposal;
  showNote?: boolean;
};

/** שורת הצעה ברשימות של ההורה (דשבורד ו"הצעות שקיבלתי") */
export default function ParentProposalListItem({
  proposal,
  showNote = false,
}: ParentProposalListItemProps) {
  const isGroomSide = proposal.side === "groom";
  const myName = displayName(
    proposal.myFirstName,
    proposal.myLastName,
    isGroomSide ? "המיועד" : "המיועדת",
  );
  const otherName = displayName(
    proposal.otherFirstName,
    proposal.otherLastName,
    isGroomSide ? "המיועדת" : "המיועד",
  );
  const shadchanName = displayName(
    proposal.shadchanFirstName,
    proposal.shadchanLastName,
    "שדכן",
  );
  const canRespond = canRespondToProposal(proposal.status, proposal.myResponse);
  const isAwaitingMyResponse = canRespond && !proposal.myResponse;
  const receivedAt = proposal.sentAt ?? proposal.createdAt;

  return (
    <Card
      size="sm"
      className="gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-body font-semibold">
            {myName} - {otherName}
          </h3>
          <Badge variant={SHIDDUCH_STATUS_BADGE_VARIANT[proposal.status]}>
            {SHIDDUCH_STATUS_LABELS[proposal.status]}
          </Badge>
          {proposal.myResponse ? (
            <Badge
              variant={SHIDDUCH_RESPONSE_BADGE_VARIANT[proposal.myResponse]}
            >
              התגובה שלכם: {SHIDDUCH_RESPONSE_LABELS[proposal.myResponse]}
            </Badge>
          ) : isAwaitingMyResponse ? (
            <Badge variant="outline">ממתין לתגובתכם</Badge>
          ) : null}
        </div>

        <p className="text-body-sm text-muted-foreground">
          מאת {shadchanName} | התקבלה: {formatDate(receivedAt)}
        </p>

        {showNote && proposal.note?.trim() ? (
          <p className="line-clamp-3 text-body-sm whitespace-pre-wrap text-muted-foreground">
            {proposal.note}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-start">
        {canRespond && (
          <ProposalResponseDialog
            shidduchId={proposal.shidduchId}
            side={proposal.side}
            title={`${myName} - ${otherName}`}
            currentResponse={proposal.myResponse}
            currentMessage={proposal.myResponseMessage}
          />
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/shidduchim/${proposal.shidduchId}`}>פתיחה</Link>
        </Button>
      </div>
    </Card>
  );
}
