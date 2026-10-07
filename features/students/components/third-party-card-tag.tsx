import { Badge } from "@/components/ui/badge";
import {
  isThirdPartyCardFor,
  isFullDisplayPending,
  thirdPartyTagExplanation,
  thirdPartyTagLabel,
  type ThirdPartyApprovalColumns,
} from "@/features/students/lib/third-party-card";

/**
 * תג "מולא ע״י צד שלישי": בשורת הרשימה, בהדר הכרטיס, בלוח העבודה ובטבלת
 * הניהול. הניסוח והטולטיפ משקפים את מצב האישורים: לפני אישור הצגה מלאה -
 * "מידע בסיסי"; אחריו - ניסוח ניטרלי. כרטיס שאינו צד שלישי: לא מוצג דבר.
 */
export function ThirdPartyCardTag({
  card,
}: {
  card: ThirdPartyApprovalColumns;
}) {
  if (!isThirdPartyCardFor(card.card_for)) return null;
  const explanation = thirdPartyTagExplanation(card);
  return (
    <Badge
      variant={isFullDisplayPending(card) ? "warning" : "neutral"}
      title={explanation}
      data-testid="third-party-card-tag"
      data-display-pending={isFullDisplayPending(card)}
    >
      {thirdPartyTagLabel(card)}
      <span className="sr-only">. {explanation}</span>
    </Badge>
  );
}
