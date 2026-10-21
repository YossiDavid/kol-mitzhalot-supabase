import { Badge } from "@/components/ui/badge";
import {
  ADMIN_EXCLUSIVE_TAG_LABEL,
  CARD_APPROVAL_LABELS,
  cardApprovalStatus,
  type CardApprovalColumns,
} from "@/features/students/lib/card-approval";
import {
  isProposalsPending,
  type ThirdPartyApprovalColumns,
} from "@/features/students/lib/third-party-card";

/**
 * תג מצב האישור: "ממתין לאישור ההנהלה", "נדחה", או "בלעדי למנהל" (מאושר
 * להצעות המנהל בלבד - העמודה חוזרת מ-student_cards למנהל בלבד, ולכן בעל
 * הכרטיס אינו רואה את התג). כרטיס מאושר אינו מציג דבר, וכך גם שורה שעמודת
 * האישור לא נשלפה עבורה (undefined) - תג "ממתין" מוצג רק כשידוע שהכרטיס אינו
 * מאושר.
 */
export function CardApprovalTag({ card }: { card: CardApprovalColumns }) {
  if (card.admin_approved_at === undefined) return null;
  const status = cardApprovalStatus(card);
  if (status === "approved") return null;
  if (status === "exclusive") {
    return (
      <Badge
        variant="info"
        title={CARD_APPROVAL_LABELS.exclusive}
        data-testid="card-approval-tag"
        data-status={status}
      >
        {ADMIN_EXCLUSIVE_TAG_LABEL}
      </Badge>
    );
  }
  return (
    <Badge
      variant={status === "rejected" ? "destructive" : "warning"}
      data-testid="card-approval-tag"
      data-status={status}
    >
      {CARD_APPROVAL_LABELS[status]}
    </Badge>
  );
}

const PROPOSALS_PENDING_TAG_LABEL = "טרם אושר להצעות";

/**
 * במאגר של המנהל: כרטיס שעוד לא קיבל אישור מלא. מצב אישור ההנהלה (ממתין /
 * נדחה / בלעדי), ובכרטיס צד שלישי שאושר להצגה אך טרם אושר לקבלת הצעות - גם
 * "טרם אושר להצעות" (תג "מולא ע״י צד שלישי" אינו אומר זאת בגלוי).
 */
export function PoolApprovalTags({
  card,
}: {
  card: CardApprovalColumns & ThirdPartyApprovalColumns;
}) {
  return (
    <>
      <CardApprovalTag card={card} />
      {card.admin_approved_at && isProposalsPending(card) && (
        <Badge variant="warning" data-testid="proposals-pending-tag">
          {PROPOSALS_PENDING_TAG_LABEL}
        </Badge>
      )}
    </>
  );
}
