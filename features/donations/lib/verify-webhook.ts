/**
 * אימות חתימת ה-HMAC של הקריאה החוזרת (webhook) של נדרים פלוס. טהור, בלי תלות ב-Next.
 *
 * האלגוריתם של הספק: הכותרת X-Nedarim-Signature היא "v1=" ואחריה HMAC-SHA256 בהקסה
 * קטנה על המחרוזת `timestamp + "." + rawBody`, כשהמפתח הוא הסוד כמחרוזת UTF-8.
 * rawBody הוא הגוף בדיוק כפי שהתקבל (לא JSON שסודר מחדש). X-Nedarim-Timestamp
 * הוא שניות יוניקס. סטייה של יותר מ-5 דקות נדחית.
 * בזמן החלפת מפתח מקבלים שני סודות במקביל.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-nedarim-signature";
export const TIMESTAMP_HEADER = "x-nedarim-timestamp";
export const SIGNATURE_PREFIX = "v1=";
export const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

const TIMESTAMP_PATTERN = /^\d{1,12}$/;
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type VerifyFailureReason =
  | "not_configured"
  | "missing_headers"
  | "bad_timestamp"
  | "stale_timestamp"
  | "bad_signature";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: VerifyFailureReason };

export interface VerifyInput {
  /** הסוד הנוכחי והקודם (להחלפת מפתח); ריקים מתעלמים מהם */
  secrets: ReadonlyArray<string | null | undefined>;
  timestampHeader: string | null;
  signatureHeader: string | null;
  /** הגוף הגולמי בדיוק כפי שהתקבל */
  rawBody: string;
  /** שניות יוניקס עכשיו (להזרקה בבדיקות) */
  nowSeconds: number;
}

/** החישוב של הספק, חשוף לבדיקות ולכלי עזר */
export function computeSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return `${SIGNATURE_PREFIX}${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;
}

/** השוואה בזמן קבוע; אורכים שונים נדחים לפני timingSafeEqual (שזורק עליהם) */
function safeEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** סודות נקיים מרווחים (הדבקה עם שורה חדשה); ריק = לא מוגדר */
export function normalizeSecrets(secrets: VerifyInput["secrets"]): string[] {
  return secrets
    .map((secret) => secret?.trim() ?? "")
    .filter((secret) => secret.length > 0);
}

/** נכשל סגור: בלי סוד, בלי כותרות, או עם חתימה/זמן לא תקינים - אין אישור */
export function verifyNedarimSignature(input: VerifyInput): VerifyResult {
  const secrets = normalizeSecrets(input.secrets);
  if (secrets.length === 0) return { ok: false, reason: "not_configured" };

  const timestamp = input.timestampHeader?.trim() ?? "";
  const signature = input.signatureHeader?.trim().toLowerCase() ?? "";
  if (!timestamp || !signature) return { ok: false, reason: "missing_headers" };

  if (!TIMESTAMP_PATTERN.test(timestamp)) {
    return { ok: false, reason: "bad_timestamp" };
  }
  const skew = Math.abs(input.nowSeconds - Number(timestamp));
  if (skew > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const isWellFormed =
    signature.startsWith(SIGNATURE_PREFIX) &&
    HEX_SHA256_PATTERN.test(signature.slice(SIGNATURE_PREFIX.length));
  if (!isWellFormed) return { ok: false, reason: "bad_signature" };

  // בודקים את כל הסודות (בלי יציאה מוקדמת) כדי לא לחשוף איזה מהם תאם
  const matches = secrets.map((secret) =>
    safeEqual(computeSignature(secret, timestamp, input.rawBody), signature),
  );
  return matches.some(Boolean)
    ? { ok: true }
    : { ok: false, reason: "bad_signature" };
}
