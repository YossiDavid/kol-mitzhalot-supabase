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
 * מה שאינו כאן במכוון: `identity_number`, `phone`, `street`, `house`,
 * `cellphone_type`, `cv_url` (קובץ הקו״ח מכיל פרטי קשר), וגם `user_id`,
 * `image_url`, `institution_id` ושדות הניהול הפנימיים - הכרטיס לא מציג
 * אותם, ואין סיבה שיישלפו.
 */
const PROPOSAL_STUDENT_COLUMNS = `id, first_name, last_name, nickname, gender, personal_status, birth_date, height, country, city, community, shtible, plan_for_life, head_cover_type, about, in_shidduchim, parents_info, family_info, author_info`;

/** נוספות רק כשהשדכן פתח את פרטי ההתקשרות להצעה */
const PROPOSAL_CONTACT_COLUMNS = `identity_number, phone, street, house, cellphone_type, cv_url`;

export type ProposalDisclosure = {
  /** השדכן פתח פרטי התקשרות (טלפון, ת.ז., כתובת, קו״ח) */
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
    ? `${PROPOSAL_STUDENT_COLUMNS}, ${PROPOSAL_CONTACT_COLUMNS}`
    : PROPOSAL_STUDENT_COLUMNS;

  const embeds = [
    "education_history(*)",
    "employment_history(*)",
    "partner_preferences(*)",
    "previous_partners(*)",
    shareContact ? "references(*)" : "references(id, reference_type, name)",
    shareMedical ? "medical_records(*)" : null,
  ].filter((embed): embed is string => embed !== null);

  return [columns, ...embeds].join(", ");
}

/** מפתחות ההתקשרות שנחתכים מתוך אובייקטי JSON בכרטיס */
const CONTACT_KEYS: readonly string[] = ["phone", "email"];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** מחזיר עותק של האובייקט בלי מפתחות ההתקשרות */
function withoutContactKeys(value: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !CONTACT_KEYS.includes(key)),
  );
}

/**
 * `parents_info` הוא אובייקט של הורה לכל מפתח ("father", "mother"), וכל
 * אחד מהם נושא טלפון ואימייל. חותכים אותם מכל ההורים.
 */
function redactParentsInfo(parentsInfo: unknown): unknown {
  if (!isRecord(parentsInfo)) return parentsInfo;
  return Object.fromEntries(
    Object.entries(parentsInfo).map(([key, parent]) => [
      key,
      isRecord(parent) ? withoutContactKeys(parent) : parent,
    ]),
  );
}

/** הטלפון היחיד שחבוי בתוך previous_partners - הרב שליווה את הגירושין */
const RABBI_PHONE_KEY = "rabbiPhone";

function redactPreviousPartners(partners: unknown): unknown {
  if (!Array.isArray(partners)) return partners;
  return partners.map((partner) => {
    if (!isRecord(partner) || !isRecord(partner.divorce_details)) {
      return partner;
    }
    const details = Object.fromEntries(
      Object.entries(partner.divorce_details).filter(
        ([key]) => key !== RABBI_PHONE_KEY,
      ),
    );
    return { ...partner, divorce_details: details };
  });
}

/**
 * חותכת מהשורה את פרטי ההתקשרות שחבויים בתוך עמודות JSON. נקראת תמיד על
 * כרטיס שנצפה דרך הצעה, וכשההתקשרות פתוחה היא מחזירה את השורה כמות שהיא.
 *
 * העתק חדש ולא שינוי במקום - השורה מגיעה מהשאילתה ואין לגעת בה.
 */
export function redactProposalStudent<T extends JsonRecord>(
  student: T,
  { shareContact }: Pick<ProposalDisclosure, "shareContact">,
): T {
  if (shareContact) return student;
  return {
    ...student,
    parents_info: redactParentsInfo(student.parents_info),
    author_info: isRecord(student.author_info)
      ? withoutContactKeys(student.author_info)
      : student.author_info,
    previous_partners: redactPreviousPartners(student.previous_partners),
  };
}
