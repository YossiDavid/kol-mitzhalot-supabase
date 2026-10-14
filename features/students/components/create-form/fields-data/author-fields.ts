import {
  CARD_GUIDANCE_PARAGRAPHS,
  CARD_GUIDANCE_TITLE,
  FILL_REASON_MAX_LENGTH,
  FILL_REASON_MIN_LENGTH,
  THIRD_PARTY_CONSEQUENCE_TEXT,
  THIRD_PARTY_CONSEQUENCE_TITLE,
} from "@/features/students/lib/third-party-card";
import {
  PARENT_RELATION_TYPES,
  THIRD_PARTY_RELATION_TYPES,
  relationOptions,
} from "@/features/students/lib/author-info";
import type { FieldCondition } from "../field-visibility";
import type { Field } from "./types";

/**
 * "מי ממלא את הכרטיס": שאלה אחת בשלב ההקדמה, ומתחתיה פרטי הממלא. עבור עצמי
 * אין פרטים; הורה: שם, טלפון וקשר (אב / אם); אדם אחר: קשר מובנה, שם, טלפון,
 * "מכיר היטב" והסבר מדוע הוא ממלא במקום המועמד/ההורים. הכול חובה במקום
 * (נאכף רק כשמוצג, required-fields.ts), לא בסוף הטופס.
 *
 * בכרטיס "עבור עצמי" גם שם מנהל/ת הכרטיס (author.name) חובה; בטופס חדש הוא
 * מתמלא מראש משם החשבון, וניתן לעריכה.
 *
 * אימייל ממלא הכרטיס (author.email) חובה בכל שלוש האפשרויות, גם "עבור עצמי"
 * (בקשת הלקוח). בטופס חדש הוא מתמלא מראש באימייל המשתמש המחובר (create/page).
 */

/** הודעת חוסר באימייל הממלא; נשארת על השדה גם כשהשמירה נעשית משלב אחר */
const AUTHOR_EMAIL_REQUIRED_MESSAGE = "נא למלא אימייל של ממלא/ת הכרטיס";

/** הודעת חוסר בשם מנהל/ת הכרטיס בכרטיס "עבור עצמי" */
const SELF_AUTHOR_NAME_REQUIRED_MESSAGE = "נא למלא שם מנהל/ת הכרטיס";

/**
 * פרמטר טופס (לא נשמר): עורך שאינו הבעלים אינו חייב למלא אימייל ממלא, ובכרטיס
 * "עבור עצמי" גם לא את שם מנהל/ת הכרטיס. אחד לשניהם: הוא אינו יכול לדעת אותם.
 */
export const AUTHOR_EMAIL_OPTIONAL_PARAM = "authorEmailOptional";
export const AUTHOR_EMAIL_OPTIONAL_VALUE = "true";

/**
 * שדה האימייל בשתי גרסאות: חובה (ברירת מחדל - יצירה ובעלים), ורשות לעורך
 * שאינו הבעלים (אדמין / שדכן): הוא לא יכול לדעת את האימייל של הממלא.
 */
function authorEmailFields(
  label: string,
  condition: FieldCondition[],
): Field[] {
  const base = {
    name: "author.email",
    width: "sm",
    label,
    type: "text",
  } as const;
  return [
    {
      ...base,
      required: true,
      requiredMessage: AUTHOR_EMAIL_REQUIRED_MESSAGE,
      condition: [
        ...condition,
        {
          parameter: AUTHOR_EMAIL_OPTIONAL_PARAM,
          operator: "!==",
          value: AUTHOR_EMAIL_OPTIONAL_VALUE,
        },
      ],
    },
    {
      ...base,
      condition: [
        ...condition,
        {
          parameter: AUTHOR_EMAIL_OPTIONAL_PARAM,
          operator: "===",
          value: AUTHOR_EMAIL_OPTIONAL_VALUE,
        },
      ],
    },
  ];
}

/**
 * שם מנהל/ת הכרטיס בכרטיס "עבור עצמי" (בהורה ובצד שלישי השם כבר חובה). חובה,
 * חוץ מעורך שאינו הבעלים (AUTHOR_EMAIL_OPTIONAL_PARAM). אותה צורה כמו האימייל.
 */
function selfAuthorNameFields(condition: FieldCondition[]): Field[] {
  const base = {
    name: "author.name",
    width: "sm",
    label: "שם מנהל/ת הכרטיס",
    type: "text",
  } as const;
  return [
    {
      ...base,
      required: true,
      requiredMessage: SELF_AUTHOR_NAME_REQUIRED_MESSAGE,
      condition: [
        ...condition,
        {
          parameter: AUTHOR_EMAIL_OPTIONAL_PARAM,
          operator: "!==",
          value: AUTHOR_EMAIL_OPTIONAL_VALUE,
        },
      ],
    },
    {
      ...base,
      condition: [
        ...condition,
        {
          parameter: AUTHOR_EMAIL_OPTIONAL_PARAM,
          operator: "===",
          value: AUTHOR_EMAIL_OPTIONAL_VALUE,
        },
      ],
    },
  ];
}

const cardForIs = (value: string): FieldCondition => ({
  parameter: "cardFor",
  operator: "===",
  value,
});

const IS_SELF = [cardForIs("self")];
const IS_PARENT = [cardForIs("child")];
const IS_THIRD_PARTY = [cardForIs("other")];
const IS_OTHER_RELATION: FieldCondition[] = [
  cardForIs("other"),
  { parameter: "author.relationType", operator: "===", value: "other" },
];

const YES_NO_OPTIONS = [
  { value: "true", label: "כן" },
  { value: "false", label: "לא" },
];

/** קופסת הסבר בתוך הטופס (HTML: ראו renderBeforeField) */
function noticeHtml(title: string, paragraphs: readonly string[]): string {
  const body = paragraphs.map((text) => `<p>${text}</p>`).join("");
  return `<div class="rounded-lg border border-border bg-muted/50 p-4 text-body-sm space-y-1"><p class="font-bold">${title}</p>${body}</div>`;
}

export const CARD_GUIDANCE_HTML = noticeHtml(
  CARD_GUIDANCE_TITLE,
  CARD_GUIDANCE_PARAGRAPHS,
);

const THIRD_PARTY_CONSEQUENCE_HTML = noticeHtml(THIRD_PARTY_CONSEQUENCE_TITLE, [
  THIRD_PARTY_CONSEQUENCE_TEXT,
]);

export const authorFields: Field[] = [
  // --- עבור עצמי ---
  ...selfAuthorNameFields(IS_SELF),
  ...authorEmailFields("האימייל שלך", IS_SELF),
  // --- הורה ---
  {
    name: "author.relationType",
    width: "sm",
    label: "הקשר שלך למיועד/ת",
    type: "select",
    options: relationOptions(PARENT_RELATION_TYPES),
    required: true,
    requiredMessage: "נא לבחור אם את/ה האב או האם",
    condition: IS_PARENT,
  },
  {
    name: "author.name",
    width: "sm",
    label: 'שם ממלא/ת הקו"ח',
    type: "text",
    required: true,
    condition: IS_PARENT,
  },
  {
    name: "author.phone",
    width: "sm",
    label: 'טלפון ממלא/ת הקו"ח',
    type: "text",
    required: true,
    condition: IS_PARENT,
  },
  ...authorEmailFields('אימייל ממלא/ת הקו"ח', IS_PARENT),
  // --- אדם אחר ---
  {
    name: "author.relationType",
    width: "sm",
    label: "הקשר שלך למיועד/ת",
    type: "select",
    options: relationOptions(THIRD_PARTY_RELATION_TYPES),
    required: true,
    requiredMessage: "נא לבחור מה הקשר שלך למיועד/ת",
    condition: IS_THIRD_PARTY,
    beforeField: THIRD_PARTY_CONSEQUENCE_HTML,
  },
  {
    name: "author.relation",
    width: "sm",
    label: "פירוט הקשר",
    type: "text",
    required: true,
    requiredMessage: "נא לפרט מה הקשר שלך למיועד/ת",
    condition: IS_OTHER_RELATION,
  },
  {
    name: "author.name",
    width: "sm",
    label: "שם מלא של ממלא/ת הכרטיס",
    type: "text",
    required: true,
    condition: IS_THIRD_PARTY,
  },
  {
    name: "author.phone",
    width: "sm",
    label: "טלפון של ממלא/ת הכרטיס",
    type: "text",
    required: true,
    condition: IS_THIRD_PARTY,
  },
  ...authorEmailFields("אימייל של ממלא/ת הכרטיס", IS_THIRD_PARTY),
  {
    name: "author.knowsWell",
    width: "full",
    label: "האם את/ה מכיר/ה היטב את המיועד/ת?",
    type: "radio",
    options: YES_NO_OPTIONS,
    required: true,
    requiredMessage: "נא לציין האם את/ה מכיר/ה היטב את המיועד/ת",
    condition: IS_THIRD_PARTY,
  },
  {
    name: "author.fillReason",
    width: "full",
    label: "מדוע הכרטיס ממולא על ידך ולא על ידי המיועד/ת או ההורים?",
    type: "textarea",
    description: `לדוגמה: למיועד אין גישה למחשב. ההסבר מוצג להנהלת המערכת בלבד (${FILL_REASON_MIN_LENGTH}–${FILL_REASON_MAX_LENGTH} תווים).`,
    required: true,
    requiredMessage: "נא להסביר מדוע הכרטיס ממולא על ידך",
    condition: IS_THIRD_PARTY,
  },
];
