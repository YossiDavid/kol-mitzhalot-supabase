import calculateAge from "@/lib/calculateAge";

/**
 * העמודות שנשלפות לגולש לא מחובר. חייבות להישאר תואמות בדיוק ל-
 * `ANONYMOUS_STUDENT_SELECT` - שום שדה רגיש (ת.ז./טלפון/סוג מכשיר/רחוב/בית/
 * קו"ח/user_id/institution_id) לא מופיע כאן. החריג המוסכם הוא הממליצים
 * (`references`), שמוצגים במלואם לבקשת הלקוח.
 */
export type AnonymousStudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  /**
   * כינוי ("יוסי" ל"יוסף"). נחשף בכוונה גם בתצוגה הציבורית: זהו כינוי פשוט
   * שמסייע בזיהוי, ולא פרט מזהה כמו ת.ז. או טלפון.
   */
  nickname: string | null;
  gender: string | null;
  personal_status: string | null;
  city: string | null;
  height: number | null;
  community: string | null;
  shtible: string | null;
  plan_for_life: string | null;
  head_cover_type: string | null;
  about: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parents_info: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  family_info: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  author_info: Record<string, any> | null;
  image_url: string | null;
  birth_date: string | null;
  deleted_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  education_history: Array<Record<string, any>> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  employment_history: Array<Record<string, any>> | null;
  /** ממליצים - מוצגים בכוונה במלואם (סוג, שם, טלפון, אימייל), גם בציבורי */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  references: Array<Record<string, any>> | null;
};

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
export const ANONYMOUS_STUDENT_SELECT = `id, first_name, last_name, nickname, gender, personal_status, city, height, community, shtible, plan_for_life, head_cover_type, about, parents_info, family_info, author_info, image_url, birth_date, deleted_at,
			education_history(*),
			employment_history(*),
			references(id, reference_type, name, phone, email)
		`;

/** ה-select של משתמש מחובר - הכרטיס המלא עם כל הטבלאות המקושרות */
export const FULL_STUDENT_SELECT = `*,
		education_history(*),
		employment_history(*),
		medical_records(*),
		partner_preferences(*),
		references(*),
		previous_partners(*)
	`;

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
  if (gender === "male") return "זכר";
  if (gender === "female") return "נקבה";
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
const PARENT_NAME_PATHS = `parents_father:parents_info->father->self, parents_mother:parents_info->mother->self`;

export const BASIC_STUDENT_SELECT = `id, user_id, first_name, last_name, nickname, gender, personal_status, birth_date, height, country, city, community, shtible, cellphone_type, cv_url, in_shidduchim, card_for, author_info, third_party_full_display_approved_at, third_party_proposals_approved_at, ${PARENT_NAME_PATHS},
		education_history(*),
		employment_history(*)`;

/** הגרסה של הגולש הלא מחובר: בלי user_id, cv_url והטלפון */
export const ANONYMOUS_BASIC_STUDENT_SELECT = `id, first_name, last_name, nickname, gender, personal_status, city, height, community, shtible, author_info, image_url, birth_date, deleted_at, ${PARENT_NAME_PATHS},
			education_history(*),
			employment_history(*)`;

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
  row: Record<string, unknown>,
): AnonymousStudentRow {
  return {
    plan_for_life: null,
    head_cover_type: null,
    about: null,
    family_info: null,
    references: null,
    ...parentsInfoFromNames(row),
  } as unknown as AnonymousStudentRow;
}
