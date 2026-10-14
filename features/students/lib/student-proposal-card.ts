import { z } from "zod";

import {
  REFERENCES_WITHOUT_CONTACT,
  STUDENT_COLUMN_SHAPE,
  buildSelect,
  embedFragment,
  pickColumns,
  pickEmbeds,
  type StudentColumn,
  type StudentEmbed,
} from "@/features/students/lib/student-row-schema";

/**
 * כרטיס המיועד כפי שמנהל כרטיס (הורה) שקיבל הצעת שידוך רואה אותו.
 *
 * זהו הווריאנט השלישי של הכרטיס, לצד `ANONYMOUS_STUDENT_SELECT` (גולש לא
 * מחובר) ו-`FULL_STUDENT_SELECT` (בעלים / שדכן / מנהל). ההיגיון זהה לשניים
 * האחרים: ההגבלה חייבת לקרות כבר ב-select ולא ב-JSX, כי כל מה שנשלף עלול
 * להגיע ל-HTML שנשלח ללקוח.
 *
 * הצד השני בהצעה לעולם אינו מקבל פרטי התקשרות - לא של המיועד/ת (טלפון,
 * כתובת), ולא של ההורים, הממליצים, ממלא הכרטיס או הרב שליווה גירושין. יצירת
 * הקשר בין הצדדים עוברת דרך השדכן בלבד. מה שהשדכן כן בוחר, לכל הצעה בנפרד:
 * לשתף את קובץ הקו״ח (shidduchim.share_cv) ולפתוח את ההצהרה הרפואית
 * (share_medical_info).
 *
 * מה שאי אפשר לחתוך ב-select הוא מפתחות בתוך עמודות JSONB (טלפון של הורה,
 * טלפון הרב המלווה בגירושין). אותם חותכת `redactProposalStudent`, שרצה תמיד
 * על השורה לפני שהיא מגיעה לרינדור.
 */

/**
 * עמודות הכרטיס בלי פרטי התקשרות וזיהוי.
 *
 * מה שאינו כאן במכוון: `phone`, `street`, `house` (לעולם לא), `cv_url` (רק
 * כשהשדכן שיתף, ראו PROPOSAL_CV_COLUMNS), וגם `user_id`, `image_url`,
 * `institution_id` ושדות הניהול הפנימיים - הכרטיס לא מציג אותם, ואין סיבה
 * שיישלפו. `cellphone_type` (כשר / חכם) כן כאן: זו העדפה כמו כיוון החיים
 * וכיסוי הראש, לא פרט התקשרות.
 */
export const PROPOSAL_STUDENT_COLUMNS = [
  "id",
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
  "plan_for_life",
  "head_cover_type",
  "about",
  "in_shidduchim",
  "cellphone_type",
  "parents_info",
  "family_info",
  "author_info",
  "card_for",
  "third_party_full_display_approved_at",
  "third_party_proposals_approved_at",
] as const satisfies readonly StudentColumn[];

/** נוספת רק כשהשדכן בחר לשתף את קובץ הקו״ח בהצעה */
export const PROPOSAL_CV_COLUMNS = [
  "cv_url",
] as const satisfies readonly StudentColumn[];

/**
 * פרטי ההתקשרות של המיועד/ת: אינם חלק מכרטיס בהצעה בשום מצב. הרשימה קיימת
 * כדי שהבדיקות יוודאו שאף אחת מהן אינה נשלפת ואינה חוזרת מהמסד.
 */
export const PROPOSAL_NEVER_COLUMNS = [
  "phone",
  "street",
  "house",
] as const satisfies readonly StudentColumn[];

/**
 * עמודות ההצהרה הרפואית שנשלפות כשהשדכן פתח אותה. מה שאינו כאן במכוון:
 * `contact_info` - מי ליצור קשר בעניין ההצהרה (ההורים, או אנשי קשר עם שם
 * וטלפון). זהו פרט התקשרות, ולכן אינו מגיע לצד השני גם כשההצהרה פתוחה.
 */
export const PROPOSAL_MEDICAL_COLUMNS = [
  "id",
  "student_id",
  "status",
  "exposure_level",
  "details",
  "documents",
  "related_issue_preference",
] as const;

const nullableText = z.string().nullable();

/**
 * ההצהרה הרפואית בהצעה. אובייקט עם מפתחות מוצהרים (ולא רשומה חופשית): מפתח
 * שלא הוצהר - ובראשם contact_info - נחתך כאן גם אם המסד החזיר אותו.
 */
const PROPOSAL_MEDICAL_RECORD = z
  .object({
    id: z.string(),
    student_id: z.string(),
    status: nullableText,
    exposure_level: nullableText,
    details: nullableText,
    documents: z.array(z.string()).nullable(),
    related_issue_preference: nullableText,
  } satisfies Record<(typeof PROPOSAL_MEDICAL_COLUMNS)[number], z.ZodType>)
  .nullable();

/** הטבלאות שנשלפות תמיד (ההצהרה הרפואית נקבעת לפי הפתיחה) */
const PROPOSAL_EMBEDS = [
  "education_history",
  "employment_history",
  "partner_preferences",
  "previous_partners",
] as const satisfies readonly StudentEmbed[];

const baseProposalSchema = z.object({
  ...pickColumns(PROPOSAL_STUDENT_COLUMNS),
  // אופציונלי רק כדי שכרטיס ייטען גם מול מסד שעוד לא קיבל את
  // 20261022090000_proposal_cv_flag.sql (שם הפונקציה אינה מחזירה אותו תמיד)
  cellphone_type: STUDENT_COLUMN_SHAPE.cellphone_type.optional(),
  ...pickEmbeds(PROPOSAL_EMBEDS),
  references: REFERENCES_WITHOUT_CONTACT,
});

const medicalProposalSchema = baseProposalSchema.extend({
  medical_records: PROPOSAL_MEDICAL_RECORD,
});

const cvProposalSchema = baseProposalSchema.extend(
  pickColumns(PROPOSAL_CV_COLUMNS),
);

const cvMedicalProposalSchema = cvProposalSchema.extend({
  medical_records: PROPOSAL_MEDICAL_RECORD,
});

/**
 * שורת הכרטיס בהצעה. `cv_url` ו-`medical_records` קיימים בטיפוס רק בווריאנטים
 * שנפתחו להם; טלפון, כתובת ופרטי קשר של ממליצים אינם קיימים באף אחד מהם,
 * ולכן קוד שניגש ל-`phone` על כרטיס בהצעה לא מתקמפל. ה-schema חותך כל מפתח
 * שלא הוצהר, גם אם המסד החזיר אותו.
 */
export type ProposalStudentRow =
  | z.infer<typeof baseProposalSchema>
  | z.infer<typeof medicalProposalSchema>
  | z.infer<typeof cvProposalSchema>
  | z.infer<typeof cvMedicalProposalSchema>;

/** מאמת את השורה מול ה-schema שמתאים למה שהשדכן פתח להצעה */
export function parseProposalRow(
  data: unknown,
  { shareCv, shareMedical }: ProposalDisclosure,
): z.ZodSafeParseResult<ProposalStudentRow> {
  if (shareCv) {
    return shareMedical
      ? cvMedicalProposalSchema.safeParse(data)
      : cvProposalSchema.safeParse(data);
  }
  return shareMedical
    ? medicalProposalSchema.safeParse(data)
    : baseProposalSchema.safeParse(data);
}

export type ProposalDisclosure = {
  /** השדכן בחר לשתף את קובץ הקו״ח */
  shareCv: boolean;
  /** השדכן פתח את ההצהרה הרפואית */
  shareMedical: boolean;
};

/**
 * בונה את ה-select לכרטיס שנצפה דרך הצעת שידוך.
 *
 * הדף עצמו כבר אינו שולח את ה-select הזה: מי שקיבל הצעה מקבל את הכרטיס
 * מ-public.get_proposal_student_card (load-student-card.ts), שמיישמת את אותו
 * כלל במסד. ה-select נשאר ההגדרה של הכלל בצד הקוד: ה-schemas שלמעלה נגזרים
 * מאותן רשימות, ו-proposal-card-gate.spec.ts משווה את תשובת הפונקציה אליו
 * מפתח מול מפתח - שינוי כאן בלי שינוי בפונקציה (או להפך) מפיל את הבדיקה.
 *
 * `references` נשלפת תמיד בלי טלפון ואימייל - השמות וסוגי הממליצים הם עיקר
 * הערך שלה, ובלעדיהם המקטע היה נעלם לגמרי.
 * `medical_records` פשוט לא נשלפת כשהיא סגורה; ה-RLS חוסם אותה ממילא,
 * וזו שכבת ההגנה השנייה.
 */
export function buildProposalStudentSelect({
  shareCv,
  shareMedical,
}: ProposalDisclosure): string {
  const columns = shareCv
    ? [...PROPOSAL_STUDENT_COLUMNS, ...PROPOSAL_CV_COLUMNS]
    : PROPOSAL_STUDENT_COLUMNS;

  const embeds = [
    ...PROPOSAL_EMBEDS.map((embed) => embedFragment(embed)),
    embedFragment("references", "id, reference_type, name"),
    shareMedical
      ? embedFragment("medical_records", PROPOSAL_MEDICAL_COLUMNS.join(", "))
      : null,
  ].filter((embed): embed is string => embed !== null);

  return buildSelect(columns, embeds);
}

/** מפתחות ההתקשרות שנחתכים מתוך אובייקטי JSON בכרטיס */
const CONTACT_KEYS = ["phone", "email"] as const;

type JsonRecord = Record<string, unknown>;

/** ערכי JSON שאינם אובייקט - עוברים כמות שהם */
type NonRecordJson =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly unknown[];

/** אובייקט JSON בלי מפתחות ההתקשרות (`never` = המפתח אינו קיים) */
export type ContactFreeJson = {
  [key: string]: unknown;
  phone?: never;
  email?: never;
};

/** הרב שליווה את הגירושין: בלי הטלפון שלו */
type NoRabbiPhoneJson = { [key: string]: unknown; rabbiPhone?: never };

/** parents_info אחרי החיתוך: אצל כל הורה אין טלפון ואימייל */
export type RedactedParentsInfo = Record<
  string,
  ContactFreeJson | NonRecordJson
>;

export type RedactedPreviousPartner = {
  [key: string]: unknown;
  divorce_details?: NoRabbiPhoneJson | NonRecordJson;
};

/**
 * השדות ש-redactProposalStudent מחליפה, בטיפוס שמבטיח שהם נקיים. שורה
 * שעברה אימות (parseProposalRow) נושאת בהם אובייקט או null, ולכן ערך אחר
 * הופך ל-null ואינו עובר הלאה.
 */
export type RedactedProposalFields = {
  parents_info: RedactedParentsInfo | null;
  author_info: ContactFreeJson | null;
  previous_partners: RedactedPreviousPartner[] | null;
};

export type RedactedProposalStudent<T extends JsonRecord> = Omit<
  T,
  keyof RedactedProposalFields
> &
  RedactedProposalFields;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContactFree(value: JsonRecord): value is ContactFreeJson {
  return !CONTACT_KEYS.some((key) => key in value);
}

function lacksRabbiPhone(value: JsonRecord): value is NoRabbiPhoneJson {
  return !(RABBI_PHONE_KEY in value);
}

/** מחזיר עותק של האובייקט בלי מפתחות ההתקשרות */
function withoutContactKeys(value: JsonRecord): ContactFreeJson {
  const filtered: JsonRecord = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !CONTACT_KEYS.some((contactKey) => contactKey === key),
    ),
  );
  // בדיקת ריצה שמחליפה cast: אם החיתוך אי פעם ייכשל, עדיף לא להציג כרטיס
  if (!isContactFree(filtered)) {
    throw new Error("redactProposalStudent: contact keys survived redaction");
  }
  return filtered;
}

/**
 * `parents_info` הוא אובייקט של הורה לכל מפתח ("father", "mother"), וכל
 * אחד מהם נושא טלפון ואימייל. חותכים אותם מכל ההורים.
 */
function redactParentsInfo(parentsInfo: unknown): RedactedParentsInfo | null {
  if (!isRecord(parentsInfo)) return null;
  return Object.fromEntries(
    Object.entries(parentsInfo).map(([key, parent]) => [
      key,
      isRecord(parent) ? withoutContactKeys(parent) : nonRecordJson(parent),
    ]),
  );
}

/** הטלפון היחיד שחבוי בתוך previous_partners - הרב שליווה את הגירושין */
const RABBI_PHONE_KEY = "rabbiPhone";

function withoutRabbiPhone(details: JsonRecord): NoRabbiPhoneJson {
  const filtered: JsonRecord = Object.fromEntries(
    Object.entries(details).filter(([key]) => key !== RABBI_PHONE_KEY),
  );
  if (!lacksRabbiPhone(filtered)) {
    throw new Error("redactProposalStudent: rabbiPhone survived redaction");
  }
  return filtered;
}

function redactPartner(partner: JsonRecord): RedactedPreviousPartner {
  const { divorce_details } = partner;
  return {
    ...partner,
    divorce_details: isRecord(divorce_details)
      ? withoutRabbiPhone(divorce_details)
      : nonRecordJson(divorce_details),
  };
}

function redactPreviousPartners(
  partners: unknown,
): RedactedPreviousPartner[] | null {
  if (!Array.isArray(partners)) return null;
  return partners.filter(isRecord).map(redactPartner);
}

/**
 * מצמצם ערך לא-אובייקט לטיפוס NonRecordJson. ערך שהוא בכל זאת אובייקט
 * (לא אמור לקרות - הקורא כבר בדק isRecord) נחשב null, ולא עובר הלאה.
 */
function nonRecordJson(value: unknown): NonRecordJson {
  if (isRecord(value)) return null;
  if (Array.isArray(value)) return value;
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
    case "undefined":
      return value;
    default:
      return null;
  }
}

/**
 * חותכת את פרטי ההתקשרות (טלפון, אימייל) מ-parents_info ומפרטי הממלא. משמשת
 * גם את הכרטיס הציבורי (קישור השיתוף), שאינו מציג פרטי קשר של אף אדם.
 */
export function withoutFamilyContact<
  T extends { parents_info?: unknown; author_info?: unknown },
>(
  row: T,
): Omit<T, "parents_info" | "author_info"> &
  Pick<RedactedProposalFields, "parents_info" | "author_info"> {
  return {
    ...row,
    parents_info: redactParentsInfo(row.parents_info),
    author_info: isRecord(row.author_info)
      ? withoutContactKeys(row.author_info)
      : null,
  };
}

/**
 * חותכת מהשורה את פרטי ההתקשרות שחבויים בתוך עמודות JSON: טלפון ואימייל של
 * כל הורה ושל ממלא הכרטיס, והטלפון של הרב שליווה גירושין. רצה תמיד על כרטיס
 * שנצפה דרך הצעה - אין מצב שבו הצד השני מקבל אותם. המסד כבר אינו מחזיר אותם
 * (get_proposal_student_card), וזו שכבת ההגנה השנייה.
 *
 * העתק חדש ולא שינוי במקום - השורה מגיעה מהשאילתה ואין לגעת בה.
 */
export function redactProposalStudent<T extends JsonRecord>(
  student: T,
): RedactedProposalStudent<T> {
  const { parents_info, author_info } = withoutFamilyContact(student);
  return {
    ...student,
    parents_info,
    author_info,
    previous_partners: redactPreviousPartners(student.previous_partners),
  };
}
