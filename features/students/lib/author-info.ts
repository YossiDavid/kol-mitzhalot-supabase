import { z } from "zod";

/**
 * ממלא הכרטיס (students.author_info, jsonb).
 *
 * צורה ישנה: { name, phone, relation } כשהקשר הוא טקסט חופשי.
 * צורה חדשה: { name, phone, relation, relationType, knowsWell }.
 *  - relationType: הקשר כבחירה מובנית (AUTHOR_RELATION_LABELS).
 *  - relation: תווית הקשר, וכשהבחירה "אחר" - הטקסט החופשי שנכתב. כך קוראים
 *    ישנים שמציגים relation ממשיכים להציג משהו הגיוני.
 *  - knowsWell: האם ממלא הכרטיס (צד שלישי) מכיר היטב את המועמד/ת. null: לא נשאל.
 *  - fillReason: מדוע הכרטיס ממולא על ידי צד שלישי ולא על ידי המועמד/ההורים.
 *    מוצג למנהלים ולממלא בלבד (לא נשלח לשדכנים).
 * כרטיס שנשמר לפני השינוי נקרא דרך readAuthorInfo, שמתרגם את הטקסט החופשי.
 */

export const AUTHOR_RELATION_LABELS = {
  father: "אב",
  mother: "אם",
  shadchan: "שדכן/ית",
  relative: "קרוב/ת משפחה",
  friend: "חבר/ה או מכר/ה",
  staff: "איש/אשת צוות במוסד",
  other: "אחר",
} as const;

export type AuthorRelationType = keyof typeof AUTHOR_RELATION_LABELS;

const RELATION_TYPES = Object.keys(AUTHOR_RELATION_LABELS) as [
  AuthorRelationType,
  ...AuthorRelationType[],
];

export const OTHER_RELATION_TYPE: AuthorRelationType = "other";

/** מי ממלא הכרטיס, לפי עבור מי הוא מולא */
export const PARENT_RELATION_TYPES: readonly AuthorRelationType[] = [
  "father",
  "mother",
];
export const THIRD_PARTY_RELATION_TYPES: readonly AuthorRelationType[] = [
  "shadchan",
  "relative",
  "friend",
  "staff",
  "other",
];

export function relationOptions(types: readonly AuthorRelationType[]) {
  return types.map((value) => ({
    value,
    label: AUTHOR_RELATION_LABELS[value],
  }));
}

export type AuthorInfo = {
  name: string;
  phone: string;
  relation: string;
  relationType: AuthorRelationType | null;
  knowsWell: boolean | null;
  fillReason: string;
};

export const EMPTY_AUTHOR_INFO: AuthorInfo = {
  name: "",
  phone: "",
  relation: "",
  relationType: null,
  knowsWell: null,
  fillReason: "",
};

const text = z.string().catch("");

const storedAuthorSchema = z.object({
  name: text,
  phone: text,
  relation: text,
  relationType: z.enum(RELATION_TYPES).nullable().catch(null),
  knowsWell: z.boolean().nullable().catch(null),
  fillReason: text,
});

/** טקסט חופשי ישן שמתאים בדיוק לאחת האפשרויות */
const LEGACY_RELATION_TYPES: Readonly<Record<string, AuthorRelationType>> = {
  אב: "father",
  אבא: "father",
  אם: "mother",
  אמא: "mother",
  שדכן: "shadchan",
  שדכנית: "shadchan",
  "שדכן/ית": "shadchan",
};

const THIRD_PARTY_CARD_FOR_VALUE = "other";

/**
 * author_info כפי שנשמר, בצורה החדשה. טקסט קשר ישן מתורגם לאפשרות כשהוא
 * תואם; בכרטיס צד שלישי טקסט אחר נשמר כ"אחר" עם הטקסט שלו, ובכרטיס הורה
 * (שאין בו "אחר") נשאר ללא בחירה - ממלא הכרטיס יבחר בעריכה הבאה.
 */
export function readAuthorInfo(
  raw: unknown,
  cardFor: string | null | undefined,
): AuthorInfo {
  const parsed = storedAuthorSchema.safeParse(raw ?? {});
  if (!parsed.success) return EMPTY_AUTHOR_INFO;
  const info = parsed.data;
  if (info.relationType || !info.relation.trim()) return info;

  const legacy = LEGACY_RELATION_TYPES[info.relation.trim()];
  if (legacy) return { ...info, relationType: legacy };
  if (cardFor === THIRD_PARTY_CARD_FOR_VALUE) {
    return { ...info, relationType: OTHER_RELATION_TYPE };
  }
  return info;
}

/** הקשר לתצוגה: "אב", "אחר: חבר של המשפחה", או הטקסט הישן כמות שהוא */
export function describeAuthorRelation(info: AuthorInfo): string {
  if (!info.relationType) return info.relation.trim();
  if (info.relationType !== OTHER_RELATION_TYPE) {
    return AUTHOR_RELATION_LABELS[info.relationType];
  }
  const detail = info.relation.trim();
  return detail
    ? `${AUTHOR_RELATION_LABELS.other}: ${detail}`
    : AUTHOR_RELATION_LABELS.other;
}

/** ערכי ממלא הכרטיס בטופס (כל השדות מחרוזות; כן/לא כ"true"/"false") */
export type AuthorFormValues = {
  name?: string;
  phone?: string;
  relation?: string;
  relationType?: string;
  knowsWell?: string;
  fillReason?: string;
};

export const KNOWS_WELL_YES = "true";
export const KNOWS_WELL_NO = "false";

function toRelationType(value: string | undefined): AuthorRelationType | null {
  const parsed = z.enum(RELATION_TYPES).safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseKnowsWell(value: string | undefined): boolean | null {
  if (value === KNOWS_WELL_YES) return true;
  if (value === KNOWS_WELL_NO) return false;
  return null;
}

/** מתוך הטופס אל מה שנשמר. "עבור עצמי": אין ממלא נפרד, ולא נשמר מה שנשאר בשדות */
export function buildAuthorInfo(
  cardFor: string | undefined,
  author: AuthorFormValues | undefined,
): AuthorInfo {
  if (cardFor !== "child" && cardFor !== THIRD_PARTY_CARD_FOR_VALUE) {
    return EMPTY_AUTHOR_INFO;
  }
  const relationType = toRelationType(author?.relationType);
  const freeText = (author?.relation ?? "").trim();
  // בחירה מובנית (חוץ מ"אחר") נשמרת גם כתווית, לקוראים שמציגים relation בלבד
  const relation =
    relationType && relationType !== OTHER_RELATION_TYPE
      ? AUTHOR_RELATION_LABELS[relationType]
      : freeText;
  return {
    name: author?.name ?? "",
    phone: author?.phone ?? "",
    relation,
    relationType,
    // "מכיר היטב" נשאל רק צד שלישי
    knowsWell:
      cardFor === THIRD_PARTY_CARD_FOR_VALUE
        ? parseKnowsWell(author?.knowsWell)
        : null,
    fillReason:
      cardFor === THIRD_PARTY_CARD_FOR_VALUE
        ? (author?.fillReason ?? "").trim()
        : "",
  };
}

/** מהשמור אל ערכי הטופס */
export function toAuthorFormValues(
  info: AuthorInfo,
): Required<AuthorFormValues> {
  return {
    name: info.name,
    phone: info.phone,
    relation: info.relationType === OTHER_RELATION_TYPE ? info.relation : "",
    relationType: info.relationType ?? "",
    knowsWell:
      info.knowsWell === null
        ? ""
        : info.knowsWell
          ? KNOWS_WELL_YES
          : KNOWS_WELL_NO,
    fillReason: info.fillReason,
  };
}

type JsonRecord = Record<string, unknown>;

/**
 * author_info בלי ההסבר "מדוע מילאתי": הוא מוצג רק למנהלים ולממלא עצמו, ולכן
 * נחתך בשרת לפני שהכרטיס מגיע לרינדור של כל צופה אחר.
 */
export function withoutFillReason<T>(authorInfo: T): T {
  if (typeof authorInfo !== "object" || authorInfo === null) return authorInfo;
  if (Array.isArray(authorInfo)) return authorInfo;
  return Object.fromEntries(
    Object.entries(authorInfo as JsonRecord).filter(
      ([key]) => key !== "fillReason",
    ),
  ) as T;
}
