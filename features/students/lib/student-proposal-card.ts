import { z } from "zod";

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
 * כרטיס המיועד כפי שמנהל כרטיס (הורה) שקיבל הצעת שידוך רואה אותו.
 *
 * זהו הווריאנט השלישי של הכרטיס, לצד `ANONYMOUS_STUDENT_SELECT` (גולש לא
 * מחובר) ו-`FULL_STUDENT_SELECT` (בעלים / שדכן / מנהל). ההיגיון זהה לשניים
 * האחרים: ההגבלה חייבת לקרות כבר ב-select ולא ב-JSX, כי כל מה שנשלף עלול
 * להגיע ל-HTML שנשלח ללקוח.
 *
 * ברירת המחדל: הכרטיס במלואו, בלי פרטי התקשרות ובלי הצהרה רפואית. יצירת
 * הקשר בין הצדדים עוברת דרך השדכן, והוא זה שיכול לפתוח כל אחד משני
 * הסוגים להצעה מסוימת (shidduchim.share_contact_details / share_medical_info).
 *
 * מה שאי אפשר לחתוך ב-select הוא מפתחות בתוך עמודות JSONB (טלפון של הורה,
 * טלפון הרב המלווה בגירושין). אותם חותכת `redactProposalStudent`, שחייבת
 * לרוץ על השורה לפני שהיא מגיעה לרינדור.
 */

/**
 * עמודות הכרטיס בלי פרטי התקשרות וזיהוי.
 *
 * מה שאינו כאן במכוון: `phone`, `street`, `house`,
 * `cellphone_type`, `cv_url` (קובץ הקו״ח מכיל פרטי קשר), וגם `user_id`,
 * `image_url`, `institution_id` ושדות הניהול הפנימיים - הכרטיס לא מציג
 * אותם, ואין סיבה שיישלפו.
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
  "parents_info",
  "family_info",
  "author_info",
  "card_for",
  "third_party_full_display_approved_at",
  "third_party_proposals_approved_at",
] as const satisfies readonly StudentColumn[];

/** נוספות רק כשהשדכן פתח את פרטי ההתקשרות להצעה */
export const PROPOSAL_CONTACT_COLUMNS = [
  "phone",
  "street",
  "house",
  "cellphone_type",
  "cv_url",
] as const satisfies readonly StudentColumn[];

/** הטבלאות שנשלפות תמיד (ממליצים והצהרה רפואית נקבעים לפי הפתיחה) */
const PROPOSAL_EMBEDS = [
  "education_history",
  "employment_history",
  "partner_preferences",
  "previous_partners",
] as const satisfies readonly StudentEmbed[];

const closedProposalSchema = z.object({
  ...pickColumns(PROPOSAL_STUDENT_COLUMNS),
  ...pickEmbeds(PROPOSAL_EMBEDS),
  references: REFERENCES_WITHOUT_CONTACT,
});

const closedMedicalProposalSchema = closedProposalSchema.extend(
  pickEmbeds(["medical_records"]),
);

const openProposalSchema = closedProposalSchema.extend({
  ...pickColumns(PROPOSAL_CONTACT_COLUMNS),
  ...pickEmbeds(["references"]),
});

const openMedicalProposalSchema = openProposalSchema.extend(
  pickEmbeds(["medical_records"]),
);

/**
 * שורת הכרטיס בהצעה. עמודות ההתקשרות קיימות בטיפוס רק בווריאנטים
 * שנפתחו להן, ולכן קוד שניגש ל-`phone` על כרטיס סגור לא מתקמפל.
 */
export type ProposalStudentRow =
  | z.infer<typeof closedProposalSchema>
  | z.infer<typeof closedMedicalProposalSchema>
  | z.infer<typeof openProposalSchema>
  | z.infer<typeof openMedicalProposalSchema>;

/** מאמת את השורה מול ה-schema שמתאים למה שהשדכן פתח להצעה */
export function parseProposalRow(
  data: unknown,
  { shareContact, shareMedical }: ProposalDisclosure,
): z.ZodSafeParseResult<ProposalStudentRow> {
  if (shareContact) {
    return shareMedical
      ? openMedicalProposalSchema.safeParse(data)
      : openProposalSchema.safeParse(data);
  }
  return shareMedical
    ? closedMedicalProposalSchema.safeParse(data)
    : closedProposalSchema.safeParse(data);
}

export type ProposalDisclosure = {
  /** השדכן פתח פרטי התקשרות (טלפון, כתובת, קו״ח) */
  shareContact: boolean;
  /** השדכן פתח את ההצהרה הרפואית */
  shareMedical: boolean;
};

/**
 * בונה את ה-select לכרטיס שנצפה דרך הצעת שידוך.
 *
 * `references` נשלפת בלי טלפון ואימייל כשההתקשרות סגורה - השמות וסוגי
 * הממליצים הם עיקר הערך שלה, ובלעדיהם המקטע היה נעלם לגמרי.
 * `medical_records` פשוט לא נשלפת כשהיא סגורה; ה-RLS חוסם אותה ממילא,
 * וזו שכבת ההגנה השנייה.
 */
export function buildProposalStudentSelect({
  shareContact,
  shareMedical,
}: ProposalDisclosure): string {
  const columns = shareContact
    ? [...PROPOSAL_STUDENT_COLUMNS, ...PROPOSAL_CONTACT_COLUMNS]
    : PROPOSAL_STUDENT_COLUMNS;

  const embeds = [
    ...PROPOSAL_EMBEDS.map((embed) => embedFragment(embed)),
    shareContact
      ? embedFragment("references")
      : embedFragment("references", "id, reference_type, name"),
    shareMedical ? embedFragment("medical_records") : null,
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
 * חותכת מהשורה את פרטי ההתקשרות שחבויים בתוך עמודות JSON. נקראת תמיד על
 * כרטיס שנצפה דרך הצעה, וכשההתקשרות פתוחה היא מחזירה את השורה כמות שהיא.
 * כשההתקשרות סגורה בטיפוס (`shareContact: false`) התוצאה היא
 * `RedactedProposalStudent` - בלי phone/email אצל ההורים ובפרטי הממלא.
 *
 * העתק חדש ולא שינוי במקום - השורה מגיעה מהשאילתה ואין לגעת בה.
 */
export function redactProposalStudent<T extends JsonRecord>(
  student: T,
  disclosure: { shareContact: false },
): RedactedProposalStudent<T>;
export function redactProposalStudent<T extends JsonRecord>(
  student: T,
  disclosure: Pick<ProposalDisclosure, "shareContact">,
): T | RedactedProposalStudent<T>;
export function redactProposalStudent<T extends JsonRecord>(
  student: T,
  { shareContact }: Pick<ProposalDisclosure, "shareContact">,
): T | RedactedProposalStudent<T> {
  if (shareContact) return student;
  return {
    ...student,
    parents_info: redactParentsInfo(student.parents_info),
    author_info: isRecord(student.author_info)
      ? withoutContactKeys(student.author_info)
      : null,
    previous_partners: redactPreviousPartners(student.previous_partners),
  };
}
