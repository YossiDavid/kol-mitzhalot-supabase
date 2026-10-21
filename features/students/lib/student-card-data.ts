import { z } from "zod";

import calculateAge from "@/lib/calculateAge";
import {
  REFERENCES_WITHOUT_CONTACT,
  buildSelect,
  embedFragment,
  pickColumns,
  pickEmbeds,
  type StudentColumn,
  type StudentEmbed,
} from "@/features/students/lib/student-row-schema";

/**
 * העמודות שנשלפות לגולש לא מחובר. שום שדה רגיש (ת.ז./טלפון/סוג מכשיר/רחוב/
 * בית/קו"ח/user_id/institution_id) לא מופיע כאן, והכרטיס הציבורי אינו מציג
 * פרטי קשר של אף אדם: הממליצים נשלפים בלי טלפון ואימייל, והטלפון והאימייל
 * שבתוך `parents_info` ו-`author_info` נחתכים לפני הרינדור
 * (shape-student-card.ts, withoutFamilyContact).
 *
 * `nickname` נחשף בכוונה גם בתצוגה הציבורית: זהו כינוי פשוט שמסייע בזיהוי,
 * ולא פרט מזהה כמו ת.ז. או טלפון.
 */
export const ANONYMOUS_STUDENT_COLUMNS = [
  "id",
  "first_name",
  "last_name",
  "nickname",
  "gender",
  "personal_status",
  "city",
  "height",
  "community",
  "shtible",
  "plan_for_life",
  "head_cover_type",
  "about",
  "parents_info",
  "family_info",
  "author_info",
  "image_url",
  "birth_date",
  "deleted_at",
] as const satisfies readonly StudentColumn[];

const ANONYMOUS_STUDENT_EMBEDS = [
  "education_history",
  "employment_history",
  "references",
] as const satisfies readonly StudentEmbed[];

const anonymousStudentSchema = z.object({
  ...pickColumns(ANONYMOUS_STUDENT_COLUMNS),
  ...pickEmbeds(ANONYMOUS_STUDENT_EMBEDS),
  // גם אם נשלפו בטעות, טלפון ואימייל של ממליץ נחתכים כאן
  references: REFERENCES_WITHOUT_CONTACT,
});

export type AnonymousStudentRow = z.infer<typeof anonymousStudentSchema>;

/**
 * אובייקט התצוגה הציבורי בפועל - בלי birth_date (הוחלף בגיל מספרי) ובלי
 * deleted_at. image_url הוא המפתח היחיד שמתווסף בתנאי.
 */
export type PublicStudent = Omit<
  AnonymousStudentRow,
  "birth_date" | "deleted_at" | "image_url"
> & {
  age: number | null;
  image_url?: string;
};

/** ה-select של הגולש הלא מחובר - בלי אף עמודה רגישה */
export const ANONYMOUS_STUDENT_SELECT = buildSelect(ANONYMOUS_STUDENT_COLUMNS, [
  embedFragment("education_history"),
  embedFragment("employment_history"),
  // בלי טלפון ואימייל: הכרטיס הציבורי אינו מציג פרטי קשר של אף אדם
  embedFragment("references", "id, reference_type, name"),
]);

/**
 * העמודות של הכרטיס המלא (select "*"): כל העמודות שהכרטיס צורך. שאילתת ה-"*"
 * מחזירה גם עמודות נוספות, אבל ה-schema חותך כל מה שלא הוצהר כאן, ולכן הן
 * אינן מגיעות לרינדור.
 */
export const FULL_STUDENT_COLUMNS = [
  "id",
  "user_id",
  "first_name",
  "last_name",
  "nickname",
  "gender",
  "personal_status",
  "birth_date",
  "height",
  "country",
  "city",
  "street",
  "house",
  "community",
  "shtible",
  "phone",
  "cellphone_type",
  "plan_for_life",
  "head_cover_type",
  "about",
  "image_url",
  "cv_url",
  "parents_info",
  "family_info",
  "author_info",
  "in_shidduchim",
  "card_for",
  "third_party_full_display_approved_at",
  "third_party_proposals_approved_at",
  "deleted_at",
  "is_kohen",
  "willing_to_live_countries",
  "native_language",
  "languages",
] as const satisfies readonly StudentColumn[];

const FULL_STUDENT_EMBEDS = [
  "education_history",
  "employment_history",
  "medical_records",
  "partner_preferences",
  "references",
  "previous_partners",
] as const satisfies readonly StudentEmbed[];

const fullStudentSchema = z.object({
  ...pickColumns(FULL_STUDENT_COLUMNS),
  ...pickEmbeds(FULL_STUDENT_EMBEDS),
});

export type FullStudentRow = z.infer<typeof fullStudentSchema>;

/** ה-select של משתמש מחובר - הכרטיס המלא עם כל הטבלאות המקושרות */
export const FULL_STUDENT_SELECT = `*, ${FULL_STUDENT_EMBEDS.map((embed) =>
  embedFragment(embed),
).join(", ")}`;

/**
 * בונה את אובייקט התצוגה הציבורי מתוך שורת ה-DB הגולמית שנשלפה עבור משתמש
 * לא מחובר. זהו המקום היחיד שבו birth_date נהפך לגיל (מספר, דרך
 * lib/calculateAge.ts) ולאחר מכן נשמט - הגיל המדויק/תאריך הלידה לעולם לא
 * מגיע ל-JSX ולכן לא יכול לדלוף דרך ה-payload המסודר (serialized) של ה-HTML.
 * deleted_at נשמט גם הוא (שימש רק לסינון ב-query).
 *
 * כלל מוחלט: image_url נכנס לאובייקט המוחזר רק כאשר gender === "male".
 * עבור כרטיס של בת המפתח image_url לא קיים בכלל באובייקט - לא רק "ריק" או
 * "לא מוצג ב-JSX" - כדי שלא תהיה שום דרך שבה הוא יזלוג ל-HTML הנשלח ללקוח.
 */
export function buildPublicStudent(row: AnonymousStudentRow): PublicStudent {
  const { birth_date, deleted_at, image_url, ...rest } = row;
  // deleted_at שימש רק לסינון ב-query (is deleted_at null) - כאן הוא נשמט
  // באופן מכוון ולא אמור להגיע לעולם ל-JSX; שורת ה-void רק "מסמנת" אותו
  // כבשימוש עבור ה-linter.
  void deleted_at;
  const age = birth_date ? Number(calculateAge(birth_date)) : null;
  return {
    ...rest,
    age,
    ...(row.gender === "male" && image_url ? { image_url } : {}),
  };
}

/** תווית המגדר בשורת המטא ובמקטע הפרטים האישיים */
export function genderToHebrew(gender: string | null | undefined) {
  if (gender === "male") return "גבר";
  if (gender === "female") return "אשה";
  return null;
}

/**
 * כרטיס צד שלישי שלא אושר להצגה מלאה, לצופה שאינו בעל הכרטיס או מנהל:
 * הנתונים הבסיסיים בלבד (third-party-card.ts). ההגבלה נעשית ב-select ולא ב-JSX,
 * כמו בשאר וריאנטי הכרטיס: מה שלא נשלף לא יכול להגיע ללקוח.
 *
 * כלול: שמות, כינוי, מגדר, גיל, עיר, קהילה, סטטוס אישי, גובה, סוג טלפון,
 * קו״ח, לימודים ותעסוקה, שמות ההורים (דרך נתיב JSON, בלי שאר parents_info)
 * ופרטי הממלא (author_info; ללא ההסבר - ראו withoutFillReason).
 * לא כלול: about, family_info, כיוון חיים, כיסוי ראש, טלפון וכתובת,
 * ואף טבלה רגישה (partner_preferences, previous_partners, references,
 * medical_records).
 */
export const BASIC_STUDENT_COLUMNS = [
  "id",
  "user_id",
  "first_name",
  "last_name",
  "nickname",
  "gender",
  "personal_status",
  "birth_date",
  "height",
  "country",
  "city",
  "community",
  "shtible",
  "cellphone_type",
  "cv_url",
  "in_shidduchim",
  "card_for",
  "author_info",
  "third_party_full_display_approved_at",
  "third_party_proposals_approved_at",
  "parents_father",
  "parents_mother",
] as const satisfies readonly StudentColumn[];

const BASIC_STUDENT_EMBEDS = [
  "education_history",
  "employment_history",
] as const satisfies readonly StudentEmbed[];

const basicStudentSchema = z.object({
  ...pickColumns(BASIC_STUDENT_COLUMNS),
  ...pickEmbeds(BASIC_STUDENT_EMBEDS),
});

export type BasicStudentRow = z.infer<typeof basicStudentSchema>;

export const BASIC_STUDENT_SELECT = buildSelect(
  BASIC_STUDENT_COLUMNS,
  BASIC_STUDENT_EMBEDS.map((embed) => embedFragment(embed)),
);

/** הגרסה של הגולש הלא מחובר: בלי user_id, cv_url והטלפון */
export const ANONYMOUS_BASIC_STUDENT_COLUMNS = [
  "id",
  "first_name",
  "last_name",
  "nickname",
  "gender",
  "personal_status",
  "city",
  "height",
  "community",
  "shtible",
  "author_info",
  "image_url",
  "birth_date",
  "deleted_at",
  "parents_father",
  "parents_mother",
] as const satisfies readonly StudentColumn[];

const anonymousBasicStudentSchema = z.object({
  ...pickColumns(ANONYMOUS_BASIC_STUDENT_COLUMNS),
  ...pickEmbeds(BASIC_STUDENT_EMBEDS),
});

export type AnonymousBasicStudentRow = z.infer<
  typeof anonymousBasicStudentSchema
>;

export const ANONYMOUS_BASIC_STUDENT_SELECT = buildSelect(
  ANONYMOUS_BASIC_STUDENT_COLUMNS,
  BASIC_STUDENT_EMBEDS.map((embed) => embedFragment(embed)),
);

/** האימות של שורת הווריאנט שחזרה מהשאילתה (הגבול בין ה-DB לקוד) */
export const studentRowSchemas = {
  anonymous: anonymousStudentSchema,
  anonymousBasic: anonymousBasicStudentSchema,
  basic: basicStudentSchema,
  full: fullStudentSchema,
} as const;

type ParentNameJson = Record<string, unknown> | null | undefined;

/** מרכיב parents_info (שמות בלבד) משני נתיבי ה-JSON של ה-select הבסיסי */
export function parentsInfoFromNames<
  T extends {
    parents_father?: ParentNameJson;
    parents_mother?: ParentNameJson;
  },
>(
  row: T,
): Omit<T, "parents_father" | "parents_mother"> & {
  parents_info: Record<string, unknown>;
} {
  const { parents_father, parents_mother, ...rest } = row;
  return {
    ...rest,
    parents_info: {
      father: { self: parents_father ?? null },
      mother: { self: parents_mother ?? null },
    },
  };
}

/** השדות שהשורה הציבורית דורשת וה-select הבסיסי אינו שולף - ריקים */
export function toAnonymousRowFromBasic(
  row: AnonymousBasicStudentRow,
): AnonymousStudentRow {
  return {
    plan_for_life: null,
    head_cover_type: null,
    about: null,
    family_info: null,
    references: null,
    ...parentsInfoFromNames(row),
  };
}
