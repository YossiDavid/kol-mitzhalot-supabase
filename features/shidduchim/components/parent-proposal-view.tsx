import Link from "next/link";

import { Box } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import calculateAge from "@/lib/calculateAge";
import MessageShadchanButton from "@/features/shidduchim/components/message-shadchan-button";
import ProposalResponseForm from "@/features/shidduchim/components/proposal-response-form";
import type { ParentProposal } from "@/features/shidduchim/lib/proposals-data";
import {
  SHIDDUCH_RESPONSE_BADGE_VARIANT,
  SHIDDUCH_RESPONSE_LABELS,
  canRespondToProposal,
  displayName,
  formatDateTime,
} from "@/features/shidduchim/lib/responses";
import {
  SHIDDUCH_STATUS_BADGE_VARIANT,
  SHIDDUCH_STATUS_LABELS,
} from "@/features/shidduchim/lib/status";

type ParentProposalViewProps = {
  proposal: ParentProposal;
  viewerId: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-body-sm font-medium text-muted-foreground">{label}</p>
      <div className="text-body">{children}</div>
    </div>
  );
}

/** כרטיס ההצעה כפי שמנהל הכרטיס (ההורה) רואה אותו, כולל תגובה לשדכן */
export default function ParentProposalView({
  proposal,
  viewerId,
}: ParentProposalViewProps) {
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
    "השדכן",
  );
  const otherDetails = [
    proposal.otherBirthDate
      ? `גיל ${calculateAge(proposal.otherBirthDate)}`
      : null,
    proposal.otherCity,
  ].filter(Boolean);
  const canRespond = canRespondToProposal(proposal.status, proposal.myResponse);
  const canMessageShadchan = proposal.shadchanId !== viewerId;

  return (
    <Box className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-subtitle font-semibold">הצעה עבור {myName}</h2>
        <Badge variant={SHIDDUCH_STATUS_BADGE_VARIANT[proposal.status]}>
          {SHIDDUCH_STATUS_LABELS[proposal.status]}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={isGroomSide ? "המיועדת המוצעת" : "המיועד המוצע"}>
          <p className="text-subtitle font-semibold">{otherName}</p>
          {otherDetails.length > 0 && (
            <p className="text-body-sm text-muted-foreground">
              {otherDetails.join(" | ")}
            </p>
          )}
          {/* הכרטיס נפתח בזכות ההצעה עצמה (shidduch_reveals_student), בלי
              פרטי התקשרות ובלי הצהרה רפואית אלא אם השדכן פתח אותם */}
          {proposal.otherStudentId && (
            <Button asChild variant="link" className="h-auto p-0">
              <Link href={`/app/students/${proposal.otherStudentId}`}>
                לכרטיס המלא
              </Link>
            </Button>
          )}
        </Field>
        <Field label="השדכן">
          <p className="font-semibold">{shadchanName}</p>
          {proposal.sentAt && (
            <p className="text-body-sm text-muted-foreground">
              נשלח: {formatDateTime(proposal.sentAt)}
            </p>
          )}
        </Field>
      </div>

      {proposal.note?.trim() && (
        <Field label="דברי השדכן">
          <div className="mt-1 rounded-lg border bg-muted/50 p-3 text-body-sm whitespace-pre-wrap">
            {proposal.note}
          </div>
        </Field>
      )}

      {proposal.myResponse && (
        <Field label="התגובה שלכם">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={SHIDDUCH_RESPONSE_BADGE_VARIANT[proposal.myResponse]}
            >
              {SHIDDUCH_RESPONSE_LABELS[proposal.myResponse]}
            </Badge>
            {proposal.myRespondedAt && (
              <span className="text-caption text-muted-foreground">
                {formatDateTime(proposal.myRespondedAt)}
              </span>
            )}
          </div>
          {proposal.myResponseMessage && (
            <p className="mt-2 text-body-sm whitespace-pre-wrap text-muted-foreground">
              {proposal.myResponseMessage}
            </p>
          )}
        </Field>
      )}

      <div className="space-y-3 border-t pt-4">
        <p className="text-body font-semibold">
          {proposal.myResponse ? "שינוי התגובה" : "מה תרצו להשיב לשדכן?"}
        </p>
        {canRespond ? (
          <ProposalResponseForm
            shidduchId={proposal.shidduchId}
            side={proposal.side}
            currentResponse={proposal.myResponse}
            currentMessage={proposal.myResponseMessage}
          />
        ) : (
          <p className="text-body-sm text-muted-foreground">
            ההצעה נסגרה, ולכן לא ניתן לעדכן את התגובה.
          </p>
        )}
      </div>

      {canMessageShadchan && (
        <MessageShadchanButton
          shadchanId={proposal.shadchanId}
          contextLine={`בנוגע להצעה: ${myName} ו${otherName}`}
        />
      )}
    </Box>
  );
}
