/**
 * מיפוי שני כרטיסי מיועדים (חתן וכלה) לשדות של מודעת אירוסין. פונקציה
 * טהורה - בלי גישה למסד - כדי שאפשר לבדוק אותה לבדה.
 */

type EducationRow = { institution_type?: unknown; name?: unknown };

/** מה שנדרש מכרטיס (students + education_history) לצורך המודעה */
export type EngagementCard = {
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  /** JSON כפי ש-buildParentsInfo שומר: { father: { self: { name } } } */
  parents_info: unknown;
  education_history: EducationRow[] | null;
};

export type EngagementSubmitter = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type EngagementDraft = {
  groom_name: string;
  groom_father: string | null;
  groom_city: string | null;
  groom_yeshiva: string | null;
  bride_name: string;
  bride_father: string | null;
  bride_city: string | null;
  bride_seminary: string | null;
  shadchan_name: string | null;
  closed_at: string;
  submitter_name: string | null;
  submitter_phone: string | null;
  submitter_email: string | null;
};

/** סוגי מוסד לפי סדר העדיפות: ישיבה גדולה לפני קטנה; הכלה - סמינר */
const GROOM_INSTITUTION_TYPES = ["yeshiva_gdola", "yeshiva_ktana"] as const;
const BRIDE_INSTITUTION_TYPES = ["seminar"] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function orNull(value: string): string | null {
  return value === "" ? null : value;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fullName(card: EngagementCard): string {
  return [text(card.first_name), text(card.last_name)]
    .filter(Boolean)
    .join(" ");
}

/** שם האב מ-parents_info.father.self.name (בלי תואר/סיומת) */
export function fatherNameOf(parentsInfo: unknown): string | null {
  const father = record(record(parentsInfo).father);
  return orNull(text(record(father.self).name));
}

/**
 * המוסד האחרון שהוזן מהסוגים הרלוונטיים, לפי סדר העדיפות של הסוגים. אין
 * בטבלה עמודת סדר/תאריך, ולכן "אחרון" הוא האחרון ברשימה - אותו סדר שבו
 * הכרטיס מציג את הלימודים.
 */
export function latestInstitutionName(
  education: EducationRow[] | null,
  types: readonly string[],
): string | null {
  const rows = education ?? [];
  for (const type of types) {
    const match = rows
      .filter((row) => text(row.institution_type) === type && text(row.name))
      .at(-1);
    if (match) return text(match.name);
  }
  return null;
}

export function buildEngagementFromCards(input: {
  groom: EngagementCard;
  bride: EngagementCard;
  shadchanName: string | null;
  submitter: EngagementSubmitter;
  closedAt: Date;
}): EngagementDraft {
  const { groom, bride, shadchanName, submitter, closedAt } = input;

  return {
    groom_name: fullName(groom),
    groom_father: fatherNameOf(groom.parents_info),
    groom_city: orNull(text(groom.city)),
    groom_yeshiva: latestInstitutionName(
      groom.education_history,
      GROOM_INSTITUTION_TYPES,
    ),
    bride_name: fullName(bride),
    bride_father: fatherNameOf(bride.parents_info),
    bride_city: orNull(text(bride.city)),
    bride_seminary: latestInstitutionName(
      bride.education_history,
      BRIDE_INSTITUTION_TYPES,
    ),
    shadchan_name: orNull(text(shadchanName)),
    closed_at: closedAt.toISOString(),
    submitter_name: orNull(text(submitter.name)),
    submitter_phone: orNull(text(submitter.phone)),
    submitter_email: orNull(text(submitter.email)),
  };
}
