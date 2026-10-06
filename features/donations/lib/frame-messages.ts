/**
 * הודעות ה-postMessage בין העמוד ל-iframe של נדרים פלוס (שיטה 3).
 * כל מה שמגיע מה-iframe נחשב לא אמין: מצמצמים אותו עם zod לאירוע מוכר בלבד.
 * הקובץ טהור (ללא DOM) כדי שאפשר יהיה לבדוק אותו ישירות.
 */
import { z } from "zod";

export const NEDARIM_FRAME_ORIGIN = "https://www.matara.pro";
/** חייב להיות עם www, אחרת Google Pay נסגר מיד */
export const NEDARIM_FRAME_URL = `${NEDARIM_FRAME_ORIGIN}/nedarimplus/iframe/v3/?language=he`;

/** מרווח שהספק ממליץ להוסיף לגובה שדווח */
export const FRAME_HEIGHT_PADDING = 15;

const envelopeSchema = z.object({
  Name: z.string(),
  Value: z.unknown().optional(),
});

const transactionSchema = z.object({
  Status: z.string(),
  Message: z.unknown().optional(),
});

const MAX_MESSAGE_LENGTH = 200;

export type FrameEvent =
  | { type: "ready" }
  | { type: "height"; height: number }
  | { type: "back" }
  | { type: "transaction"; isOk: boolean; message: string | null }
  | { type: "other" };

/**
 * Value של TransactionResponse מגיע כמחרוזת JSON או כאובייקט. Message (טקסט הסירוב)
 * נקרא רק כשהוא מחרוזת, ונחתך באורכו.
 */
function parseTransactionValue(value: unknown): {
  isOk: boolean;
  message: string | null;
} {
  let candidate = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      return { isOk: false, message: null };
    }
  }
  const parsed = transactionSchema.safeParse(candidate);
  if (!parsed.success) return { isOk: false, message: null };
  const message =
    typeof parsed.data.Message === "string"
      ? parsed.data.Message.trim().slice(0, MAX_MESSAGE_LENGTH)
      : "";
  return {
    isOk: parsed.data.Status === "OK",
    message: message || null,
  };
}

/** מחזיר null להודעה שאינה בפורמט של הספק (תתעלם ממנה) */
export function parseFrameMessage(data: unknown): FrameEvent | null {
  const envelope = envelopeSchema.safeParse(data);
  if (!envelope.success) return null;
  const { Name, Value } = envelope.data;

  switch (Name) {
    case "Ready":
      return { type: "ready" };
    case "Height": {
      const height = parseInt(String(Value), 10);
      return Number.isFinite(height) && height >= 0
        ? { type: "height", height }
        : null;
    }
    case "Back":
      return { type: "back" };
    case "TransactionResponse":
      return { type: "transaction", ...parseTransactionValue(Value) };
    default:
      // PaymentMethod / WalletCanceled / PendingTransaction: ה-iframe מטפל בהם בעצמו
      return { type: "other" };
  }
}
