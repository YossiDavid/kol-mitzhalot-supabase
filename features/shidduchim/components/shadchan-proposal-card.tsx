import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SideResponse } from "@/features/shidduchim/lib/proposals-data";
import {
  displayName,
  formatDate,
  type ShidduchSide,
} from "@/features/shidduchim/lib/responses";
import {
  SHIDDUCH_STATUS_BADGE_VARIANT,
  SHIDDUCH_STATUS_LABELS,
} from "@/features/shidduchim/lib/status";

import ShadchanProposalSide, {
  type SideResponseState,
} from "./shadchan-proposal-side";
import {
  wasSentToSide,
  type RecipientScope,
  type ShadchanProposal,
} from "./shadchan-proposals-data";

const SCOPE_LABEL: Record<RecipientScope, string> = {
  both: "נשלחה לשני הצדדים",
  groom_only: "נשלחה לצד המיועד בלבד",
  bride_only: "נשלחה לצד המיועדת בלבד",
};

export interface SideExtras {
  details?: readonly string[];
  cvUrl?: string | null;
}

interface ShadchanProposalCardProps {
  proposal: ShadchanProposal;
  /** תגובות הצדדים. בלי הפרופ לא מוצגים תגי תגובה כלל */
  responses?: readonly SideResponse[];
  /** h2 ברשימה עצמאית, h3 בתוך מקטע שכבר יש לו h2 */
  headingLevel?: 2 | 3;
  /** פעולות נוספות לפני "פתיחה" (למשל עריכה ושליחה של טיוטה) */
  actions?: ReactNode;
  extras?: Partial<Record<ShidduchSide, SideExtras>>;
}

function dateLine(proposal: ShadchanProposal): string {
  const created = `נוצרה ${formatDate(proposal.createdAt)}`;
  if (proposal.status === "draft") {
    return `נשמרה ${formatDate(proposal.updatedAt)} · ${created}`;
  }
  return proposal.sentAt
    ? `נשלחה ${formatDate(proposal.sentAt)} · ${created}`
    : created;
}

function responseStateFor(
  side: ShidduchSide,
  proposal: ShadchanProposal,
  responses: readonly SideResponse[] | undefined,
): SideResponseState {
  // טיוטה, או שליחה שבוטלה — אין לצדדים מה לענות
  if (!responses || proposal.status === "draft" || !proposal.recipientScope) {
    return null;
  }
  const response = responses.find(
    (r) => r.shidduchId === proposal.id && r.side === side,
  );
  if (response) return { kind: "responded", response: response.response };
  return wasSentToSide(side, proposal.recipientScope)
    ? { kind: "pending" }
    : { kind: "not_sent" };
}

/** כרטיס הצעת שידוך מצד השדכן: שני צדדים זה לצד זה, סטטוס ופעולות */
export default function ShadchanProposalCard({
  proposal,
  responses,
  headingLevel = 2,
  actions,
  extras,
}: ShadchanProposalCardProps) {
  const HeadingTag = headingLevel === 2 ? "h2" : "h3";
  const nameAs = headingLevel === 2 ? "h3" : "h4";
  const titleId = `proposal-${proposal.id}-title`;
  const pairLabel = `${displayName(proposal.groom?.firstName, proposal.groom?.lastName, "ללא שם")} - ${displayName(proposal.bride?.firstName, proposal.bride?.lastName, "ללא שם")}`;
  const scopeLabel =
    proposal.status !== "draft" && proposal.recipientScope
      ? SCOPE_LABEL[proposal.recipientScope]
      : null;

  return (
    <article
      aria-labelledby={titleId}
      className="box @container flex h-full flex-col gap-4 border p-4 md:p-5"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <HeadingTag id={titleId} className="sr-only">
          {pairLabel}
        </HeadingTag>
        <Badge variant={SHIDDUCH_STATUS_BADGE_VARIANT[proposal.status]}>
          {SHIDDUCH_STATUS_LABELS[proposal.status]}
        </Badge>
        <p className="text-caption text-muted-foreground">
          {dateLine(proposal)}
        </p>
      </header>

      <div className="grid flex-1 gap-4 @lg:grid-cols-2 @lg:gap-0">
        <ShadchanProposalSide
          side="groom"
          person={proposal.groom}
          note={proposal.noteForGroom}
          responseState={responseStateFor("groom", proposal, responses)}
          nameAs={nameAs}
          className="@lg:pe-5"
          {...extras?.groom}
        />
        <ShadchanProposalSide
          side="bride"
          person={proposal.bride}
          note={proposal.noteForBride}
          responseState={responseStateFor("bride", proposal, responses)}
          nameAs={nameAs}
          className="border-t pt-4 @lg:border-s @lg:border-t-0 @lg:ps-5 @lg:pt-0"
          {...extras?.bride}
        />
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t pt-3">
        {scopeLabel ? (
          <p className="text-caption text-muted-foreground">{scopeLabel}</p>
        ) : null}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {actions}
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/app/shidduchim/${proposal.id}`}
              aria-label={`פתיחת ההצעה ${pairLabel}`}
            >
              פתיחה
            </Link>
          </Button>
        </div>
      </footer>
    </article>
  );
}
