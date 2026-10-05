/**
 * פענוח סלחני של גוף הקריאה החוזרת של נדרים פלוס. טהור.
 * לפי התיעוד שמות השדות לא משתנים אבל נוספים חדשים והסדר עשוי להשתנות, ולכן:
 * מפתחות לא מוכרים מותרים, ערכים יכולים להיות מחרוזת או מספר, והחיפוש אינו
 * תלוי רישיות. הגוף המלא נשמר בנפרד כ-raw.
 */
import { z } from "zod";

export const CALLBACK_KIND = {
  transaction: "transaction",
  kevaCreated: "keva_created",
} as const;

export type CallbackKind = (typeof CALLBACK_KIND)[keyof typeof CALLBACK_KIND];

export interface NormalizedCallback {
  kind: CallbackKind;
  transactionId: string | null;
  kevaId: string | null;
  /** ה-Param2 כפי שחזר (אמור להיות ה-id של תרומה) */
  param2: string | null;
  amount: number | null;
  /** 1 = שקל, 2 = דולר; null כשלא זוהה */
  currency: 1 | 2 | null;
  /** מספר האישור מ-Shva; null כשחסר, ריק או "0" */
  confirmation: string | null;
  /** מספר הסולק (Solek); null כשלא זוהה */
  solek: number | null;
  /**
   * עסקה זמנית: עדכון עסקה של כרטיס אשראי בלי מספר אישור. אסור לראות בה שולם.
   * תמיד false בהקמת הוראת קבע (אינה חיוב).
   */
  isTemporary: boolean;
  last4: string | null;
  transactionTime: string | null;
}

const MAX_FIELD_LENGTH = 200;

/**
 * סולקים שאינם כרטיס אשראי של Shva: 27/28/29 ביט, 30 העברה בקליק, 31 מטבע
 * דיגיטלי. לפי התיעוד מספר האישור הוא של Shva, ולכן אצלם לא דורשים Confirmation.
 * זו ההסקה שלנו מהתיעוד ולא הצהרה מפורשת של הספק; אם יתברר שגם הם אמורים
 * לשאת אישור, מסירים את המספר מכאן וזה הכול.
 */
export const NON_CARD_SOLEKS: ReadonlySet<number> = new Set([
  27, 28, 29, 30, 31,
]);

const bodySchema = z.record(z.string(), z.unknown());

/** מפתחות באותיות קטנות; בהתנגשות הראשון מנצח */
function lowerKeyed(body: Record<string, unknown>): Map<string, unknown> {
  const entries = new Map<string, unknown>();
  for (const [key, value] of Object.entries(body)) {
    const lower = key.toLowerCase();
    if (!entries.has(lower)) entries.set(lower, value);
  }
  return entries;
}

function readText(fields: Map<string, unknown>, key: string): string | null {
  const value = fields.get(key.toLowerCase());
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().slice(0, MAX_FIELD_LENGTH);
  return text === "" ? null : text;
}

/** "0" ו"" נחשבים אין אישור (כבר אחרי trim ב-readText) */
function readConfirmation(fields: Map<string, unknown>): string | null {
  const text = readText(fields, "Confirmation");
  return text === null || /^0+$/.test(text) ? null : text;
}

export function parseSolek(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

/** "1,000.50" ו-"180" ו-180 תקינים; כל דבר אחר null */
export function parseAmount(value: string | null): number | null {
  if (value === null) return null;
  const amount = Number(value.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

const SHEKEL_VALUES = new Set(["1", "ils", "nis", "₪", "שקל"]);
const DOLLAR_VALUES = new Set(["2", "usd", "$", "dollar", "דולר"]);

export function parseCurrency(value: string | null): 1 | 2 | null {
  const lower = value?.toLowerCase() ?? "";
  if (SHEKEL_VALUES.has(lower)) return 1;
  if (DOLLAR_VALUES.has(lower)) return 2;
  return null;
}

/**
 * null כשהגוף אינו אובייקט JSON או שאי אפשר לזהות את סוגו:
 * יש TransactionId = עדכון עסקה; אין אבל יש KevaId = הקמת הוראת קבע.
 */
export function parseNedarimCallback(
  jsonText: string,
): NormalizedCallback | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  const body = bodySchema.safeParse(parsed);
  if (!body.success) return null;

  const fields = lowerKeyed(body.data);
  const transactionId = readText(fields, "TransactionId");
  const kevaId = readText(fields, "KevaId");
  const kind = transactionId
    ? CALLBACK_KIND.transaction
    : kevaId
      ? CALLBACK_KIND.kevaCreated
      : null;
  if (!kind) return null;

  const confirmation = readConfirmation(fields);
  const solek = parseSolek(readText(fields, "Solek"));
  const isNonCard = solek !== null && NON_CARD_SOLEKS.has(solek);

  return {
    kind,
    transactionId,
    kevaId,
    param2: readText(fields, "Param2"),
    amount: parseAmount(readText(fields, "Amount")),
    currency: parseCurrency(readText(fields, "Currency")),
    confirmation,
    solek,
    isTemporary:
      kind === CALLBACK_KIND.transaction && confirmation === null && !isNonCard,
    last4: readText(fields, "LastNum"),
    transactionTime: readText(fields, "TransactionTime"),
  };
}
