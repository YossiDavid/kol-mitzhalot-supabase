/**
 * הורה שנפטר: "מי נפטר" נשאל רק כשסטטוס ההורים הוא אלמנ/ה, אבל הערך נשאר
 * בטופס אחרי שינוי הסטטוס. לכן הבדיקה תמיד בודקת גם את הסטטוס. מקום אחד
 * לשמירה (build-student-payload.ts) ולכרטיס (family-section.tsx).
 */

export type ParentRole = "father" | "mother";

const WIDOWED_STATUS = "widowed";
const BOTH_DEAD = "both";

export function isParentDeceased(
  parents: { status?: unknown; deadParent?: unknown } | null | undefined,
  role: ParentRole,
): boolean {
  if (parents?.status !== WIDOWED_STATUS) return false;
  return parents.deadParent === role || parents.deadParent === BOTH_DEAD;
}
