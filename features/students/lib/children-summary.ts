import { getTotalChildrenCount } from "@/features/students/lib/previous-partner-children";

/** הסטטוסים שיש להם נישואים קודמים, ולכן מידע על ילדים בשורת הרשימה */
const STATUSES_WITH_PREVIOUS_MARRIAGE: readonly string[] = [
  "divorced",
  "widowed",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatCount(count: number): string {
  return count === 1 ? "ילד אחד" : `${count} ילדים`;
}

/**
 * הטקסט על הילדים בשורת הרשימה של גרוש/אלמן:
 * - יש ילדים: המספר ("ילד אחד" / "N ילדים").
 * - "ללא ילדים": רק כשכל שורות הנישואים סומנו במפורש כ-no_children.
 * - המידע לא מולא: null - מציגים כלום ולא "ללא ילדים", כדי שלא לטעות.
 * מי שאינו גרוש/אלמן אינו מקבל טקסט גם אם נשארה לו שורה ישנה.
 */
export function summarizeChildren(
  personalStatus: string | null | undefined,
  partners: unknown,
): string | null {
  if (
    !personalStatus ||
    !STATUSES_WITH_PREVIOUS_MARRIAGE.includes(personalStatus)
  )
    return null;
  if (!Array.isArray(partners)) return null;

  const total = getTotalChildrenCount(partners);
  if (total > 0) return formatCount(total);

  const marriages = partners.filter(isRecord);
  const isExplicitlyChildless =
    marriages.length > 0 &&
    marriages.every((marriage) => marriage.no_children === true);
  return isExplicitlyChildless ? "ללא ילדים" : null;
}
