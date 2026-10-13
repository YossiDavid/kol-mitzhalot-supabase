import { Badge } from "@/components/ui/badge";
import {
  CARD_APPROVAL_LABELS,
  cardApprovalStatus,
  type CardApprovalColumns,
} from "@/features/students/lib/card-approval";

/**
 * תג מצב האישור בטבלת הכרטיסים של המשתמש: "ממתין לאישור ההנהלה" או "נדחה".
 * כרטיס מאושר אינו מציג דבר, וכך גם שורה שעמודת האישור לא נשלפה עבורה
 * (undefined) - תג "ממתין" מוצג רק כשידוע שהכרטיס אינו מאושר.
 */
export function CardApprovalTag({ card }: { card: CardApprovalColumns }) {
  if (card.admin_approved_at !== null) return null;
  const status = cardApprovalStatus(card);
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
