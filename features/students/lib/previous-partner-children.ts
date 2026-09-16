import calculateAge from "@/lib/calculateAge";

/**
 * ילדים מנישואים קודמים: המבנה ששמור ב-previous_partners.children, הערך
 * בטופס, והנוסח בכרטיס. מקום אחד לטופס (children-list-field.tsx), לשמירה
 * (build-student-payload.ts), לטעינה (student-to-form.ts) ולדף הכרטיס.
 */

export type ChildGender = "male" | "female";

/** אצל מי הילד/ה גר/ה. "student" - אצל המיועד/ת עצמו/ה */
export type ChildLivesWith =
  | "student"
  | "other_parent"
  | "shared"
  | "independent";

const CHILD_GENDERS: readonly ChildGender[] = ["male", "female"];

const CHILD_LIVES_WITH_VALUES: readonly ChildLivesWith[] = [
  "student",
  "other_parent",
  "shared",
  "independent",
];

/** פריט ב-previous_partners.children (ראה COMMENT על העמודה) */
export interface StoredPartnerChild {
  gender: ChildGender | null;
  /** YYYY-MM-DD */
  birth_date: string | null;
  lives_with: ChildLivesWith | null;
  is_married: boolean;
}

/** פריט ב-previousPartners.<i>.children בערכי הטופס */
export interface PartnerChildFormValue {
  gender: string;
  /** כמו שאר התאריכים בטופס: DD/MM/YYYY */
  birthDate: string;
  livesWith: string;
  isMarried: boolean;
}

/**
 * בשורה ישנה נשמר רק מספר ילדים בלי פרטים. הטופס שומר את המספר תחת המפתח
 * הזה בשורת הנישואים, כדי שהשמירה לא תמחק אותו עד שיתווספו הפרטים.
 */
export const LEGACY_CHILDREN_COUNT_KEY = "legacyChildrenNumber";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toChildGender(value: unknown): ChildGender | null {
  return CHILD_GENDERS.includes(value as ChildGender)
    ? (value as ChildGender)
    : null;
}

export function toChildLivesWith(value: unknown): ChildLivesWith | null {
  return CHILD_LIVES_WITH_VALUES.includes(value as ChildLivesWith)
    ? (value as ChildLivesWith)
    : null;
}

/** קריאה בטוחה של העמודה: פריט שאינו אובייקט מושמט, ערך לא מוכר הופך ל-null */
export function parseStoredChildren(value: unknown): StoredPartnerChild[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((child) => {
    const birthDate =
      typeof child.birth_date === "string" ? child.birth_date.slice(0, 10) : "";
    return {
      gender: toChildGender(child.gender),
      birth_date: ISO_DATE_PATTERN.test(birthDate) ? birthDate : null,
      lives_with: toChildLivesWith(child.lives_with),
      is_married: child.is_married === true,
    };
  });
}

/** גיל בשנים מלאות מתאריך ISO. תאריך חסר, לא תקין או עתידי - null */
export function getAgeInYears(
  isoDate: string | null | undefined,
): number | null {
  if (!isoDate || !ISO_DATE_PATTERN.test(isoDate)) return null;
  const age = Number(calculateAge(isoDate));
  return Number.isInteger(age) && age >= 0 ? age : null;
}

/** "גיל 7", ומתחת לשנה "פחות משנה" */
export function formatChildAge(age: number): string {
  return age < 1 ? "פחות משנה" : `גיל ${age}`;
}

/** מספר הילדים לתצוגה: מהרשימה, ובשורה ישנה בלי פרטים - מהמספר שנשמר */
export function getChildrenCount(
  children: readonly unknown[],
  legacyCount: unknown,
): number {
  if (children.length > 0) return children.length;
  const legacy = Number(legacyCount);
  return Number.isInteger(legacy) && legacy > 0 ? legacy : 0;
}

export function formatChildrenCount(count: number): string {
  if (count <= 0) return "אין ילדים";
  if (count === 1) return "ילד אחד";
  return `${count} ילדים`;
}

/**
 * סך הילדים מכל הנישואים הקודמים - לשורת המטא בכרטיס ("גרוש + 3"). כל שורה
 * נספרת באותם כללים של המקטע עצמו: מהרשימה, ובשורה ישנה מהמספר שנשמר.
 */
export function getTotalChildrenCount(partners: unknown): number {
  if (!Array.isArray(partners)) return 0;
  return partners
    .filter(isRecord)
    .reduce(
      (total, partner) =>
        total +
        getChildrenCount(
          parseStoredChildren(partner.children),
          partner.children_number,
        ),
      0,
    );
}

type StudentGender = string | null | undefined;

/** ההורה שהוא המיועד/ת עצמו/ה, וההורה השני */
function parentTitles(studentGender: StudentGender) {
  if (studentGender === "male") return { self: "האב", other: "האם" };
  if (studentGender === "female") return { self: "האם", other: "האב" };
  return { self: "המיועד/ת", other: "ההורה השני" };
}

function describeLivesWith(
  livesWith: ChildLivesWith,
  childGender: ChildGender | null,
  studentGender: StudentGender,
): string {
  const lives = childGender === "female" ? "גרה" : "גר";
  const parents = parentTitles(studentGender);
  switch (livesWith) {
    case "student":
      return `${lives} אצל ${parents.self}`;
    case "other_parent":
      return `${lives} אצל ${parents.other}`;
    case "shared":
      return "משמורת משותפת";
    case "independent":
      return childGender === "female" ? "עצמאית" : "עצמאי";
  }
}

/** שורה בכרטיס: "בן · גיל 7 · גר אצל האם · נשוי" */
export function describeChild(
  child: StoredPartnerChild,
  studentGender: StudentGender,
): string {
  const age = getAgeInYears(child.birth_date);
  const parts = [
    child.gender === "female" ? "בת" : child.gender === "male" ? "בן" : "ילד/ה",
    age === null ? null : formatChildAge(age),
    child.lives_with
      ? describeLivesWith(child.lives_with, child.gender, studentGender)
      : null,
    child.is_married ? (child.gender === "female" ? "נשואה" : "נשוי") : null,
  ];
  return parts.filter(Boolean).join(" · ");
}
