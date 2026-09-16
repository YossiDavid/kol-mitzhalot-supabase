import calculateAge from "@/lib/calculateAge";

/**
 * העמודות שנשלפות לגולש לא מחובר. חייבות להישאר תואמות בדיוק ל-
 * `ANONYMOUS_STUDENT_SELECT` - שום שדה רגיש (ת.ז./טלפון/סוג מכשיר/רחוב/בית/
 * קו"ח/user_id/institution_id) לא מופיע כאן.
 */
export type AnonymousStudentRow = {
  id: string;
  first_name: string;
  last_name: string;
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
export const ANONYMOUS_STUDENT_SELECT = `id, first_name, last_name, gender, personal_status, city, height, community, shtible, plan_for_life, head_cover_type, about, parents_info, family_info, author_info, image_url, birth_date, deleted_at,
			education_history(*),
			employment_history(*)
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
