import { Badge } from "@/components/ui/badge";
import {
  NEW_CARD_BADGE_LABELS,
  newCardBadge,
} from "@/features/students/lib/new-card-window";

/** תג "חדש היום" / "חדש השבוע" ליד השם. כרטיס שאינו חדש - לא מוצג דבר */
export function NewCardBadge({
  createdAt,
  now,
}: {
  createdAt: string | null | undefined;
  /** הרגע הנוכחי - נמסר מהקורא כדי שכל השורות יחושבו לפי אותו רגע */
  now: Date;
}) {
  const kind = newCardBadge(createdAt, now);
  if (!kind) return null;
  return (
    <Badge
      variant={kind === "today" ? "default" : "info"}
      data-testid="new-card-badge"
      data-kind={kind}
    >
      {NEW_CARD_BADGE_LABELS[kind]}
    </Badge>
  );
}
