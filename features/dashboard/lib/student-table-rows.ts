import { z } from "zod";

/**
 * שורות טבלאות המיועדים בדשבורד (מועדפים, "המיועדים שלך"). מקור אמת יחיד:
 * `STUDENT_TABLE_SHAPE` מצהיר על כל שדה בשורה ועל הטיפוס שלו, ו-
 * `STUDENT_TABLE_SELECT` מצהיר על פריט ה-select שלו. שני האובייקטים
 * מוגדרים על אותם מפתחות (`satisfies`), ולכן עמודה שנוספה לאחד ולא לשני לא
 * מתקמפלת - וטעות בשם עמודה נכשלת באימות בזמן ריצה במקום להיעלם בשקט.
 *
 * אין כאן העמודות הכבדות של הכרטיס המלא (family_info, author_info, about...)
 * ולא ההיסטוריות והרשומות הרפואיות - הכרטיס המלא נשלף בדף הכרטיס עצמו.
 */

const text = z.string().nullable();

/** שם עם תואר, כפי שנשמר ב-parents_info. ערכים חסרים או null מותרים */
const parentName = z
  .object({
    prefix: z.string().nullish(),
    name: z.string().nullish(),
    suffix: z.string().nullish(),
  })
  .nullish();

const parent = z.object({ self: parentName }).nullish();

export const STUDENT_TABLE_SHAPE = {
  id: z.string(),
  gender: z.enum(["male", "female"]),
  personal_status: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  nickname: text,
  parents_info: z.object({ father: parent, mother: parent }).nullable(),
  city: text,
  community: text,
  birth_date: text,
  height: z.number().nullable(),
  cv_url: text,
  photo_count: z.number().nullable(),
  status_changed_at: text,
  in_shidduchim: z.boolean().nullable(),
  card_for: z.enum(["self", "child", "other"]).nullable(),
  third_party_full_display_approved_at: text,
  third_party_proposals_approved_at: text,
  proposal_limit_count: z.number().nullable(),
  proposal_limit_period: text,
  admin_paused_at: text,
  previous_partners: z.array(z.record(z.string(), z.unknown())).nullable(),
} as const;

export type StudentTableData = z.infer<typeof studentTableRowSchema>;

/** פריט ה-select לכל שדה. ב-parents_info: שמות הורים בלבד בכרטיס מוגבל */
export const STUDENT_TABLE_SELECT = {
  id: "id",
  gender: "gender",
  personal_status: "personal_status",
  first_name: "first_name",
  last_name: "last_name",
  nickname: "nickname",
  // נקרא מ-student_cards: שמות הורים בלבד בכרטיס צד שלישי שלא אושר להצגה מלאה
  parents_info: "parents_info",
  city: "city",
  community: "community",
  birth_date: "birth_date",
  height: "height",
  cv_url: "cv_url",
  photo_count: "photo_count",
  status_changed_at: "status_changed_at",
  in_shidduchim: "in_shidduchim",
  // עבור מי מולא הכרטיס: קובע את הכותרת ("הכרטיס שלי" / "המיועדים שלך") ותג בשורה
  card_for: "card_for",
  third_party_full_display_approved_at: "third_party_full_display_approved_at",
  third_party_proposals_approved_at: "third_party_proposals_approved_at",
  // נדרשות לבקרות של מנהל הכרטיס בטבלה: מכסת ההצעות ונעילת ההשהיה של ההנהלה
  proposal_limit_count: "proposal_limit_count",
  proposal_limit_period: "proposal_limit_period",
  admin_paused_at: "admin_paused_at",
  // לשורת הילדים של גרוש/אלמן. ללא הרשאה (RLS) חוזר מערך ריק
  previous_partners:
    "previous_partners(children, children_number, no_children)",
} as const satisfies Record<keyof typeof STUDENT_TABLE_SHAPE, string>;

export const STUDENT_TABLE_COLUMNS =
  Object.values(STUDENT_TABLE_SELECT).join(", ");

const studentTableRowSchema = z.object(STUDENT_TABLE_SHAPE);

const studentTableRowsSchema = z.array(studentTableRowSchema);

/** מאמת את השורות שחזרו מה-DB; הכשל מוחזר לקורא, שרושם ומציג "לא נטען" */
export function parseStudentTableRows(data: unknown) {
  return studentTableRowsSchema.safeParse(data ?? []);
}
