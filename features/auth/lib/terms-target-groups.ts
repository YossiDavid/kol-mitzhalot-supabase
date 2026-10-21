/**
 * קבוצות היעד של גרסת תקנון (terms_versions.target_groups). זהות לקבוצות
 * ב-terms_group_matches; ראו supabase/migrations/20261101090000_terms_version_targets.sql.
 * רשימה ריקה = כל המשתמשים.
 */

export const TERMS_TARGET_GROUPS = ["shadchan", "staff", "user"] as const;

export type TermsTargetGroup = (typeof TERMS_TARGET_GROUPS)[number];

export const TERMS_TARGET_GROUP_LABELS: Record<TermsTargetGroup, string> = {
  shadchan: "שדכנים",
  staff: "צוות",
  user: "משתמשים רגילים",
};

export const ALL_USERS_LABEL = "כל המשתמשים";

export function isTermsTargetGroup(value: unknown): value is TermsTargetGroup {
  return (
    typeof value === "string" &&
    (TERMS_TARGET_GROUPS as readonly string[]).includes(value)
  );
}

/** "כל המשתמשים" / "שדכנים, צוות" - לפי הסדר הקבוע */
export function describeTargetGroups(
  groups: readonly TermsTargetGroup[] | null,
): string {
  if (!groups || groups.length === 0) return ALL_USERS_LABEL;
  return TERMS_TARGET_GROUPS.filter((group) => groups.includes(group))
    .map((group) => TERMS_TARGET_GROUP_LABELS[group])
    .join(", ");
}

/** הוספה/הסרה של קבוצה - מחזיר רשימה חדשה, בסדר הקבוע */
export function toggleTargetGroup(
  groups: readonly TermsTargetGroup[],
  group: TermsTargetGroup,
  isChecked: boolean,
): TermsTargetGroup[] {
  return TERMS_TARGET_GROUPS.filter((item) =>
    item === group ? isChecked : groups.includes(item),
  );
}
