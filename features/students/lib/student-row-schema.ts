import { z } from "zod";

/**
 * מקור האמת היחיד לעמודות כרטיס המיועד. אין בפרויקט טיפוסי DB שנוצרו
 * (supabase gen types), ולכן כל וריאנט של הכרטיס מצהיר כאן על רשימת עמודות
 * אחת (tuple), ממנה נגזרים גם מחרוזת ה-select, גם הטיפוס (Pick) וגם
 * ה-schema שמאמת את השורה שחזרה מהשאילתה. כך אי אפשר להוסיף או לשנות עמודה
 * ברשימה בלי שהטיפוס והאימות יתעדכנו, ולהפך.
 *
 * העמודות נלקחו מ-students בבייסליין (20260101000000_remote_baseline.sql)
 * ומהמיגרציות שהוסיפו לה nickname, card_for, אישורי צד שלישי ו-deleted_at.
 */

const text = z.string().nullable();

/**
 * עמודות JSON חופשיות. ערך שאינו אובייקט (נתון ישן) הופך ל-null - הרכיבים
 * מתייחסים ל-null כ"אין מידע", ואף פעם לא נחשף ערך שלא עבר אימות.
 */
const jsonObject = z.record(z.string(), z.any()).nullable().catch(null);

export const STUDENT_COLUMN_SHAPE = {
  id: z.string(),
  user_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  nickname: text,
  gender: z.enum(["male", "female"]).nullable(),
  personal_status: text,
  birth_date: text,
  height: z.number().nullable(),
  country: text,
  city: text,
  street: text,
  house: text,
  community: text,
  shtible: text,
  phone: text,
  cellphone_type: text,
  plan_for_life: text,
  head_cover_type: text,
  about: text,
  image_url: text,
  cv_url: text,
  parents_info: jsonObject,
  family_info: jsonObject,
  author_info: jsonObject,
  in_shidduchim: z.boolean().nullable(),
  card_for: text,
  third_party_full_display_approved_at: text,
  third_party_proposals_approved_at: text,
  deleted_at: text,
  // אופציונליות: כרטיס נטען גם מול מסד שעוד לא קיבל את
  // 20261027100000_card_countries_and_admin_focus.sql
  /** כהן - לגבר בלבד. null = לא צוין */
  is_kohen: z.boolean().nullable().optional(),
  /** "מוכן/ה לגור ב:" - שמות ארצות. null = לא צוין */
  willing_to_live_countries: z.array(z.string()).nullable().optional(),
  /** כינויים של נתיבי JSON ב-BASIC (ראו COLUMN_SELECT_FRAGMENTS) */
  parents_father: jsonObject,
  parents_mother: jsonObject,
} as const;

type StudentShape = typeof STUDENT_COLUMN_SHAPE;
export type StudentColumn = keyof StudentShape;

/** עמודות שה-select שלהן אינו שם העמודה עצמו (כינוי לנתיב JSON) */
const COLUMN_SELECT_FRAGMENTS: Partial<Record<StudentColumn, string>> = {
  parents_father: "parents_father:parents_info->father->self",
  parents_mother: "parents_mother:parents_info->mother->self",
};

const embedRows = z.array(z.record(z.string(), z.any())).nullable();
const embedObject = z.record(z.string(), z.any()).nullable();

/** הטבלאות המקושרות (embeds) שהכרטיס יכול לשלוף */
export const EMBED_SHAPE = {
  education_history: embedRows,
  employment_history: embedRows,
  previous_partners: embedRows,
  references: embedRows,
  /** one-to-one (UNIQUE על student_id): אובייקט ולא מערך */
  partner_preferences: embedObject,
  medical_records: embedObject,
} as const;

type EmbedShape = typeof EMBED_SHAPE;
export type StudentEmbed = keyof EmbedShape;

/** ממליצים בלי טלפון ואימייל - ה-schema חותך אותם גם אם נשלפו בטעות */
export const REFERENCES_WITHOUT_CONTACT = z
  .array(
    z.object({
      id: z.string(),
      reference_type: text,
      name: text,
    }),
  )
  .nullable();

/** פריט ה-select של עמודה */
function columnFragment(column: StudentColumn): string {
  return COLUMN_SELECT_FRAGMENTS[column] ?? column;
}

/** פריט ה-select של embed. ברירת המחדל: כל העמודות */
export function embedFragment(embed: StudentEmbed, columns = "*"): string {
  return `${embed}(${columns})`;
}

/** מחרוזת ה-select: העמודות ואז ה-embeds, בסדר שהוצהר */
export function buildSelect(
  columns: readonly StudentColumn[],
  embedFragments: readonly string[],
): string {
  return [...columns.map(columnFragment), ...embedFragments].join(", ");
}

/**
 * ה-shape של העמודות שברשימה. זהו המקום היחיד עם cast בנתיב הזה: TypeScript
 * אינו יכול להסיק ש-Object.fromEntries על tuple מחזיר בדיוק Pick, אבל
 * הבנייה עצמה מפה כל שם עמודה לפי הערך שלו ב-STUDENT_COLUMN_SHAPE, ואין לה
 * דרך להוסיף מפתח שאינו ברשימה (מכוסה בבדיקת הגארד).
 */
export function pickColumns<const C extends readonly StudentColumn[]>(
  columns: C,
): Pick<StudentShape, C[number]> {
  return Object.fromEntries(
    columns.map((column) => [column, STUDENT_COLUMN_SHAPE[column]]),
  ) as Pick<StudentShape, C[number]>;
}

/** אותו עיקרון ל-embeds */
export function pickEmbeds<const E extends readonly StudentEmbed[]>(
  embeds: E,
): Pick<EmbedShape, E[number]> {
  return Object.fromEntries(
    embeds.map((embed) => [embed, EMBED_SHAPE[embed]]),
  ) as Pick<EmbedShape, E[number]>;
}
