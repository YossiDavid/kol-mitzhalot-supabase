import { Badge } from "@/components/ui/badge";
import {
  isSelfCard,
  SELF_CARD_TAG,
  type CardFor,
} from "@/features/students/lib/own-cards-heading";

/** תג "הכרטיס שלי" בשורה של כרטיס שהמשתמש מילא לעצמו */
export function SelfCardTag({ cardFor }: { cardFor: CardFor }) {
  if (!isSelfCard({ card_for: cardFor })) return null;
  return (
    <Badge variant="neutral" data-testid="self-card-tag">
      {SELF_CARD_TAG}
    </Badge>
  );
}
