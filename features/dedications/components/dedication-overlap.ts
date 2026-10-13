import { isSponsorKind } from "@/features/dedications/lib/dedication-model";
import type { AdminDedication } from "@/features/dedications/lib/dedication-model";
import type { DedicationFormValues } from "@/features/dedications/lib/dedication-schema";
import { rangesOverlap } from "@/features/dedications/lib/israel-date";

/**
 * הקדשות מפורסמות אחרות מאותו סוג פרנס, בתקופה החופפת לטופס. חפיפה אינה
 * חסימה (כמה הקדשות ליום אחד מוצגות כולן); היא רק אזהרה למנהל.
 * הנצחות אינן נבדקות: מותר כמה שרוצים במקביל.
 */
export function findOverlaps(
  values: Pick<DedicationFormValues, "kind" | "starts_on" | "ends_on">,
  all: readonly AdminDedication[],
  editingId: string | null,
): AdminDedication[] {
  if (!isSponsorKind(values.kind)) return [];
  if (!values.starts_on || !values.ends_on) return [];
  if (values.ends_on < values.starts_on) return [];

  const range = { starts_on: values.starts_on, ends_on: values.ends_on };
  return all.filter(
    (other) =>
      other.id !== editingId &&
      other.kind === values.kind &&
      other.is_published &&
      rangesOverlap(range, other),
  );
}
