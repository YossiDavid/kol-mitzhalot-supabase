import { dedicationPeriodLabel } from "@/features/dedications/lib/dedication-period";
import { ISO_DATE_PATTERN } from "@/features/dedications/lib/israel-date";

/** "13.10.2026" מתוך ISO, כדי להציג הנצחה פתוחה ("החל מ-...") */
function gregorian(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)}.${Number(month)}.${year}`;
}

/**
 * תקופת קובייה בניהול: עברי ראשי ולועזי בסוגריים. הלועזי בבידוד כיווני
 * (bdi dir=ltr), אחרת מספרים וסימנים מתהפכים בתוך משפט בעברית.
 */
export function DedicationPeriodText({
  startsOn,
  endsOn,
}: {
  startsOn: string;
  endsOn: string | null;
}) {
  const period = dedicationPeriodLabel(startsOn, endsOn);
  if (period) {
    return (
      <>
        {period.hebrew} <bdi dir="ltr">({period.gregorian})</bdi>
      </>
    );
  }
  if (!endsOn && ISO_DATE_PATTERN.test(startsOn)) {
    return (
      <>
        החל מ-<bdi dir="ltr">{gregorian(startsOn)}</bdi>, ללא סיום
      </>
    );
  }
  return null;
}
