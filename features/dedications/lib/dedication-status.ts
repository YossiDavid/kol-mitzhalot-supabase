import {
  isCurrentInIsrael,
  type DatedRange,
} from "@/features/dedications/lib/israel-date";

export type DedicationStatus = "current" | "upcoming" | "past" | "unpublished";

export const STATUS_LABELS: Record<DedicationStatus, string> = {
  current: "מוצגת עכשיו",
  upcoming: "עתידית",
  past: "הסתיימה",
  unpublished: "לא מפורסמת",
};

/** סטטוס בניהול. "לא מפורסמת" גוברת על התאריכים */
export function dedicationStatus(
  item: DatedRange & { is_published: boolean },
  today: string,
): DedicationStatus {
  if (!item.is_published) return "unpublished";
  if (isCurrentInIsrael(item, today)) return "current";
  return item.starts_on > today ? "upcoming" : "past";
}
