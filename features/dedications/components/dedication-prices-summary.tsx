import {
  KIND_LABELS,
  SPONSOR_KINDS_LARGEST_FIRST,
} from "@/features/dedications/lib/dedication-model";
import type { DedicationPrices } from "@/features/dedications/lib/dedication-prices";

/** שורת מצב בניהול: מחיר כל פרנס, או שלא הוגדר (הקובייה מפנה לתרומה רגילה) */
export function DedicationPricesSummary({
  prices,
}: {
  prices: DedicationPrices;
}) {
  const hasAny = SPONSOR_KINDS_LARGEST_FIRST.some(
    (kind) => prices[kind] !== undefined,
  );
  return (
    <p
      data-testid="dedication-prices-summary"
      className="text-body-sm text-muted-foreground"
    >
      {hasAny
        ? "מחירי פרנס: "
        : "לא הוגדרו מחירי פרנס: הקוביות הפנויות מפנות לתרומה רגילה. "}
      {hasAny
        ? SPONSOR_KINDS_LARGEST_FIRST.map(
            (kind) =>
              `${KIND_LABELS[kind]} ${
                prices[kind] === undefined
                  ? "ללא רכישה"
                  : `${prices[kind].toLocaleString("he-IL")} ₪`
              }`,
          ).join(" · ")
        : 'אפשר לקבוע מחיר בכפתור "מחירי פרנס".'}
    </p>
  );
}
