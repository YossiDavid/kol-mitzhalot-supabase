import { FileText } from "lucide-react";

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import calculateAge from "@/lib/calculateAge";
import { cn } from "@/lib/utils";
import {
  SHIDDUCH_RESPONSE_BADGE_VARIANT,
  SHIDDUCH_RESPONSE_LABELS,
  displayName,
  type ShidduchResponse,
  type ShidduchSide,
} from "@/features/shidduchim/lib/responses";

import type { ProposalPerson } from "./shadchan-proposals-data";

/** מצב התגובה של צד אחד. null = לא מציגים (טיוטה, או שאין נתוני תגובות) */
export type SideResponseState =
  | { kind: "responded"; response: ShidduchResponse }
  | { kind: "pending" }
  | { kind: "not_sent" }
  | null;

const SIDE_TITLE: Record<ShidduchSide, string> = {
  groom: "מיועד",
  bride: "מיועדת",
};

const NOTE_TITLE: Record<ShidduchSide, string> = {
  groom: "הערה למיועד",
  bride: "הערה למיועדת",
};

function ResponseChip({ state }: { state: SideResponseState }) {
  if (!state) return null;

  // מצבים שאינם תגובה בפועל מקבלים תג ניטרלי
  const { label, variant }: { label: string; variant: BadgeVariant } =
    state.kind === "responded"
      ? {
          label: SHIDDUCH_RESPONSE_LABELS[state.response],
          variant: SHIDDUCH_RESPONSE_BADGE_VARIANT[state.response],
        }
      : state.kind === "pending"
        ? { label: "ממתינים לתגובה", variant: "neutral" }
        : { label: "לא נשלחה לצד זה", variant: "neutral" };

  return (
    <Badge variant={variant} className="self-start">
      <span className="sr-only">תגובת הצד: </span>
      {label}
    </Badge>
  );
}

const AGE_PREFIX: Record<ShidduchSide, string> = { groom: "בן", bride: "בת" };

function metaLine(side: ShidduchSide, person: ProposalPerson | null): string {
  const age = person?.birthDate
    ? `${AGE_PREFIX[side]} ${calculateAge(person.birthDate)}`
    : "גיל לא צוין";
  return [age, person?.city?.trim() || "עיר לא צוינה"].join(" · ");
}

interface ShadchanProposalSideProps {
  side: ShidduchSide;
  person: ProposalPerson | null;
  note: string | null;
  responseState: SideResponseState;
  /** פרטים נוספים בשורה אחת (למשל שם האב, מוסד, עיסוק) */
  details?: readonly string[];
  /** קישור לקו״ח, כשקיים */
  cvUrl?: string | null;
  nameAs: "h3" | "h4";
  className?: string;
}

/** עמודה של צד אחד בכרטיס הצעה: שם, גיל ועיר, תגובה והערה */
export default function ShadchanProposalSide({
  side,
  person,
  note,
  responseState,
  details,
  cvUrl,
  nameAs: NameTag,
  className,
}: ShadchanProposalSideProps) {
  const name = displayName(person?.firstName, person?.lastName, "ללא שם");
  const trimmedNote = note?.trim();
  const detailsLine = details?.filter(Boolean).join(" · ");

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <p className="text-caption font-bold text-primary">{SIDE_TITLE[side]}</p>

      <div className="flex min-w-0 items-center gap-2">
        <NameTag className="truncate text-subtitle font-bold text-foreground">
          {name}
        </NameTag>
        {cvUrl ? (
          <a
            href={cvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-sm text-primary hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <FileText className="size-4" aria-hidden />
            <span className="sr-only">קו״ח של {name}</span>
          </a>
        ) : null}
      </div>

      <p className="text-body-sm text-muted-foreground">
        {metaLine(side, person)}
      </p>
      {detailsLine ? (
        <p className="text-caption text-muted-foreground">{detailsLine}</p>
      ) : null}

      <ResponseChip state={responseState} />

      <div className="mt-1 border-s-2 border-primary-muted ps-3">
        <p className="text-caption font-bold text-muted-foreground">
          {NOTE_TITLE[side]}
        </p>
        {trimmedNote ? (
          <p className="line-clamp-3 text-body-sm whitespace-pre-wrap text-foreground">
            {trimmedNote}
          </p>
        ) : (
          <p className="text-body-sm text-muted-foreground">לא נכתבה הערה</p>
        )}
      </div>
    </div>
  );
}
