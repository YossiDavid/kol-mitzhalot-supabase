import calculateAge from "@/lib/calculateAge";
import {
  formatParentName,
  isParentDeceased,
} from "@/features/students/lib/deceased-parents";
import {
  formatFirstNameWithNickname,
  personalStatusToHebrew,
} from "@/features/students/lib/profile-labels";
import {
  isDisplayRestricted,
  type ThirdPartyApprovalColumns,
} from "@/features/students/lib/third-party-card";

/**
 * העמודות שסיכום המועמד בכרטיס השידוך שולף. כולן בתוך BASIC_STUDENT_SELECT
 * (student-card-data.ts) חוץ משתיים, שנשלפות מנתיב JSON ומשמשות רק כשהכרטיס
 * אינו מוגבל: סטטוס ההורים ומי נפטר (כדי להוסיף ז״ל). בלי טלפון, כתובת
 * מדויקת, אימייל, קו״ח, רפואי וממליצים.
 */
export const CANDIDATE_SUMMARY_SELECT = `first_name, last_name, nickname, gender, birth_date, personal_status, country, city, community, shtible, user_id, card_for, third_party_full_display_approved_at, third_party_proposals_approved_at, parents_father:parents_info->father->self, parents_mother:parents_info->mother->self, parents_status:parents_info->status, parents_dead:parents_info->deadParent`;

const HOME_COUNTRY = "ישראל";

type ParentNameJson = {
  prefix?: string | null;
  name?: string | null;
  suffix?: string | null;
} | null;

export type CandidateSummaryRow = ThirdPartyApprovalColumns & {
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  gender: string | null;
  birth_date: string | null;
  personal_status: string | null;
  country: string | null;
  city: string | null;
  community: string | null;
  shtible: string | null;
  user_id: string | null;
  parents_father: unknown;
  parents_mother: unknown;
  parents_status: unknown;
  parents_dead: unknown;
};

export type CandidateSummary = {
  fullName: string;
  age: string | null;
  residence: string | null;
  community: string | null;
  personalStatus: string | null;
  parents: string | null;
};

function asParentName(value: unknown): ParentNameJson {
  return value && typeof value === "object" ? (value as ParentNameJson) : null;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function joinParts(parts: readonly (string | null)[], separator: string) {
  const present = parts.filter((part): part is string => part !== null);
  return present.length > 0 ? present.join(separator) : null;
}

/**
 * הסיכום להצגה. הצופה כאן הוא תמיד השדכן של ההצעה או מנהל; כרטיס צד שלישי
 * בלי אישור הצגה מוגבל לנתונים הבסיסיים גם אליו (אותו כלל כמו בכרטיס המלא),
 * ולכן סטטוס ההורים אינו נקרא ממנו ושמות ההורים מוצגים בלי ז״ל.
 */
export function buildCandidateSummary(
  row: CandidateSummaryRow,
  fallbackName: string,
  viewer: { id: string; isAdmin: boolean },
): CandidateSummary {
  const isRestricted = isDisplayRestricted(row, {
    isOwner: row.user_id === viewer.id,
    isAdmin: viewer.isAdmin,
  });
  const parentsInfo = isRestricted
    ? null
    : { status: row.parents_status, deadParent: row.parents_dead };

  const first = nonEmpty(row.first_name);
  const last = nonEmpty(row.last_name);
  const fullName = first
    ? `${formatFirstNameWithNickname(first, row.nickname)} ${last ?? ""}`.trim()
    : (last ?? fallbackName);

  const country = nonEmpty(row.country);
  const father = formatParentName(
    asParentName(row.parents_father),
    isParentDeceased(parentsInfo, "father"),
  );
  const mother = formatParentName(
    asParentName(row.parents_mother),
    isParentDeceased(parentsInfo, "mother"),
  );

  return {
    fullName,
    age: row.birth_date ? calculateAge(row.birth_date) : null,
    residence: joinParts(
      [
        nonEmpty(row.city),
        country && country !== HOME_COUNTRY ? country : null,
      ],
      ", ",
    ),
    community: joinParts(
      [
        nonEmpty(row.community),
        nonEmpty(row.shtible) ? `שטיבל ${nonEmpty(row.shtible)}` : null,
      ],
      " · ",
    ),
    personalStatus: row.personal_status
      ? personalStatusToHebrew(row.personal_status, row.gender ?? undefined)
      : null,
    parents: joinParts([nonEmpty(father), nonEmpty(mother)], " ו"),
  };
}
