import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * תג "כהן" בולט: בהדר הכרטיס, בשורת המאגר ובלוח העבודה - כדי שהשדכן לא
 * יחמיץ את כלל הכהן והגרושה. רק לגבר שסימן "כהן" (is_kohen = true); ערך אחר,
 * חסר או כרטיס של אישה - כלום.
 */
export function KohenBadge({
  card,
  className,
}: {
  card: { gender?: string | null; is_kohen?: boolean | null };
  className?: string;
}) {
  if (card.gender !== "male" || card.is_kohen !== true) return null;
  return (
    <Badge
      variant="default"
      className={cn("font-bold", className)}
      data-testid="kohen-badge"
    >
      כהן
    </Badge>
  );
}
