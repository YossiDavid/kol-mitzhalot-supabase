/**
 * פענוח סלחני של גוף הקריאה החוזרת של נדרים פלוס. טהור.
 * לפי התיעוד שמות השדות לא משתנים אבל נוספים חדשים והסדר עשוי להשתנות, ולכן:
 * מפתחות לא מוכרים מותרים, ערכים יכולים להיות מחרוזת או מספר, והחיפוש אינו
 * תלוי רישיות. הגוף המלא נשמר בנפרד כ-raw.
 *
 * שני מקורות שולחים לנו: ה-CallBack של העסקה (אותו JSON כמו TransactionResponse של ה-iframe:
 * Status + ID, ובהוראת קבע גם NextDate ו-AuthorisationNumber), וה-Webhook ברמת המוסד
 * ("עדכוני עסקאות": TransactionId). לכן מזהה העסקה הוא TransactionId, ובהיעדרו ID
 * (כש-Status הוא OK או חסר).
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

interface ExemptionFields {
  solek: number | null;
  paymentMethod: string | null;
  preTransactionId: string | null;
}

/** האם אמצעי התשלום אינו כרטיס אשראי של Shva, ולכן אין לדרוש בו Confirmation */
function isConfirmationExempt(fields: ExemptionFields): boolean {
  return (
    (fields.solek !== null && NON_CARD_SOLEKS.has(fields.solek)) ||
    NON_CARD_PAYMENT_METHODS.has(fields.paymentMethod?.toLowerCase() ?? "") ||
    fields.preTransactionId !== null
  );
}

const MAX_FIELD_LENGTH = 200;

/**
 * אמצעי תשלום בלי מספר אישור של Shva (ביט והעברה בקליק): מדווחים ב-PaymentMethod או עם
 * PreTransactionId, ולפעמים בלי Solek. הכלל לפטור מ-Confirmation נמצא כאן ובמקום אחד נוסף
 * (NON_CARD_SOLEKS), ו-isConfirmationExempt הוא המקום היחיד שמשלב אותם.
 */
const NON_CARD_PAYMENT_METHODS: ReadonlySet<string> = new Set([
  "bit",
  "digitaltransfer",
]);

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
  const status = readText(fields, "Status")?.toLowerCase() ?? null;
  const isStatusOk = status === null || status === "ok";
  const transactionIdField = readText(fields, "TransactionId");
  // ID הוא מזהה העסקה ב-CallBack של העסקה; בהוראת קבע (HK) הוא מזהה ההוראה
  const idField = isStatusOk ? readText(fields, "ID") : null;
  const hasKevaCreationMarker =
    fields.has("authorisationnumber") || readText(fields, "NextDate") !== null;
  const isKevaCreationById =
    transactionIdField === null && idField !== null && hasKevaCreationMarker;

  const transactionId = isKevaCreationById
    ? null
    : (transactionIdField ?? idField);
  const kevaId =
    readText(fields, "KevaId") ?? (isKevaCreationById ? idField : null);
  const kind = transactionId
    ? CALLBACK_KIND.transaction
    : kevaId
      ? CALLBACK_KIND.kevaCreated
      : null;
  if (!kind) return null;

  const confirmation = readConfirmation(fields);
  const solek = parseSolek(readText(fields, "Solek"));
  const isExempt = isConfirmationExempt({
    solek,
    paymentMethod: readText(fields, "PaymentMethod"),
    preTransactionId: readText(fields, "PreTransactionId"),
  });

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
      kind === CALLBACK_KIND.transaction && confirmation === null && !isExempt,
    last4: readText(fields, "LastNum"),
    transactionTime: readText(fields, "TransactionTime"),
  };
}

/** עדכון שגיאה/סירוב מהספק: Status=Error, לעולם בלי TransactionId או Confirmation */
export interface ErrorUpdate {
  /** טקסט הסירוב (עברית או קוד), כפי שהגיע */
  message: string | null;
  /** Transaction או Keva */
  source: string | null;
  /** קוד הסירוב של חברת האשראי (ErrorCode), בדחיית חיוב בלבד */
  errorCode: string | null;
  /** ה-id של התרומה כפי שחזר (אמור להיות uuid) */
  param2: string | null;
}

/**
 * עדכון שגיאה: Status שווה ל-Error (בלי רגישות לרישיות) ואין TransactionId.
 * null בכל מקרה אחר, כולל גוף שאינו JSON. בכוונה לא קוראים שדות לקוח (שם/טלפון/מייל/זהות).
 */
export function parseNedarimErrorUpdate(jsonText: string): ErrorUpdate | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }
  const body = bodySchema.safeParse(parsed);
  if (!body.success) return null;

  const fields = lowerKeyed(body.data);
  const isError = readText(fields, "Status")?.toLowerCase() === "error";
  if (!isError || readText(fields, "TransactionId")) return null;

  return {
    message: readText(fields, "Message"),
    source: readText(fields, "Source"),
    errorCode: readText(fields, "ErrorCode"),
    param2: readText(fields, "Param2"),
  };
}

export type NedarimBody =
  | { type: "invalid_json" }
  | { type: "error_update"; update: ErrorUpdate }
  | { type: "payment"; callback: NormalizedCallback }
  | { type: "unrecognized" };

/**
 * סיווג גוף חתום: רק טקסט שאינו JSON הוא invalid_json (400); כל JSON אחר מאושר
 * ב-200, גם כשאיננו פועלים לפיו, כי הספק שולח כל עדכון פעם אחת ומתריע על כל כשל.
 */
export function classifyNedarimBody(jsonText: string): NedarimBody {
  try {
    JSON.parse(jsonText);
  } catch {
    return { type: "invalid_json" };
  }
  const update = parseNedarimErrorUpdate(jsonText);
  if (update) return { type: "error_update", update };
  const callback = parseNedarimCallback(jsonText);
  return callback ? { type: "payment", callback } : { type: "unrecognized" };
}
