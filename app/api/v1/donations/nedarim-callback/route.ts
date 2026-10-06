/**
 * Callers: שרתי נדרים פלוס בלבד (POST אחד לאחר עסקה מוצלחת, ללא ניסיון חוזר).
 * ציבורי (אין סשן): ההרשאה היא חתימת ה-HMAC על הגוף הגולמי. נכשל סגור.
 * מתעד אידמפוטנטית, מתאים ל-Param2 ומסמן "שולם" דרך record_nedarim_payment
 * (עסקה זמנית, בלי Confirmation, נרשמת אך לא מסומנת שולם).
 * מחזיר {WEBDocID: ref} כשהותאם, אחרת {}.
 * עדכון שגיאה (Status=Error בלי TransactionId) ובכלל כל JSON חתום שאיננו מזהים נענה ב-200 {}:
 * הספק שולח כל עדכון פעם אחת ומתריע בדוא"ל על כל תשובה שאינה 2xx. 400 רק לגוף חתום שאינו
 * JSON, ו-401 לחתימה שגויה. רץ ב-Node (ברירת המחדל; export runtime אסור עם
 * cacheComponents), כי האימות משתמש ב-node:crypto.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import {
  classifyNedarimBody,
  type ErrorUpdate,
} from "@/features/donations/lib/parse-callback";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyNedarimSignature,
} from "@/features/donations/lib/verify-webhook";
import { isKnownNedarimIp } from "@/features/donations/lib/webhook-ips";

const LOG_TAG = "[donations/webhook]";
/** גוף עדכון אמיתי הוא כמה KB; מעל זה אין טעם אפילו לחשב חתימה */
const MAX_BODY_BYTES = 64 * 1024;

/** תשובת אישור: חתום ותקין, גם אם לא פעלנו לפיו */
const acknowledge = () => NextResponse.json({});

/** הטקסט שנשמר בתרומה: ההודעה, ובסופה קוד הסירוב אם יש */
function describeError(update: ErrorUpdate): string | null {
  const code = update.errorCode ? `(${update.errorCode})` : null;
  return [update.message, code].filter(Boolean).join(" ") || null;
}

/** רושם ניסיון שנכשל בתרומה הממתינה; לא מסמן שולם לעולם. כשל רישום נרשם בלוג ואינו משנה את התשובה */
async function handleErrorUpdate(update: ErrorUpdate) {
  // בלי שמות, טלפונים, מיילים או מספרי זהות: רק מה שנדרש לאבחון
  console.warn(LOG_TAG, {
    event: "error_update",
    kind: "error_update",
    message: update.message,
    source: update.source,
    errorCode: update.errorCode,
    param2: update.param2,
  });
  if (!update.param2) return;
  try {
    const { error } = await createAdminClient().rpc("record_donation_error", {
      p_param2: update.param2,
      p_message: describeError(update),
    });
    if (error) {
      console.error(LOG_TAG, {
        event: "error_update_record_failed",
        error: describeSupabaseError(error),
      });
    }
  } catch (error) {
    console.error(LOG_TAG, { event: "error_update_record_failed", error });
  }
}

function reject(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // הגוף נקרא פעם אחת כטקסט גולמי, לפני כל פענוח JSON: החתימה היא על הבייטים
  // שהתקבלו ולא על JSON שסודר מחדש. proxy.ts רק מרענן סשן ואינו נוגע בגוף.
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    console.warn(LOG_TAG, { event: "body_too_large", ip });
    return reject(413, "Payload too large");
  }

  const verification = verifyNedarimSignature({
    secrets: [
      process.env.NEDARIM_WEBHOOK_SECRET,
      process.env.NEDARIM_WEBHOOK_SECRET_PREVIOUS,
    ],
    timestampHeader: request.headers.get(TIMESTAMP_HEADER),
    signatureHeader: request.headers.get(SIGNATURE_HEADER),
    rawBody,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!verification.ok) {
    console.warn(LOG_TAG, {
      event: "rejected",
      reason: verification.reason,
      ip,
    });
    return reject(401, "Unauthorized");
  }

  if (!isKnownNedarimIp(ip)) {
    console.warn(LOG_TAG, { event: "unknown_ip_valid_signature", ip });
  }

  const body = classifyNedarimBody(rawBody);
  if (body.type === "invalid_json") {
    console.warn(LOG_TAG, { event: "invalid_json", ip });
    return reject(400, "Invalid JSON");
  }
  if (body.type === "error_update") {
    await handleErrorUpdate(body.update);
    return acknowledge();
  }
  if (body.type === "unrecognized") {
    console.warn(LOG_TAG, { event: "unrecognized_body", ip });
    return acknowledge();
  }
  const { callback } = body;

  if (callback.amount === null || callback.currency === null) {
    // אין כיסוי בתיעוד לכך שהשדות תמיד נשלחים: מתקבל על סמך חתימה ו-Param2, וזה לא נבדק מול התרומה
    console.warn(LOG_TAG, {
      event: "amount_not_cross_checked",
      hasAmount: callback.amount !== null,
      hasCurrency: callback.currency !== null,
      transactionId: callback.transactionId,
      kevaId: callback.kevaId,
      param2: callback.param2,
    });
  }

  try {
    const { data, error } = await createAdminClient().rpc(
      "record_nedarim_payment",
      {
        p_kind: callback.kind,
        p_transaction_id: callback.transactionId,
        p_keva_id: callback.kevaId,
        p_param2: callback.param2,
        p_amount: callback.amount,
        p_currency: callback.currency,
        p_confirmation: callback.confirmation,
        p_last4: callback.last4,
        p_transaction_time: callback.transactionTime,
        p_raw: JSON.parse(rawBody),
        p_is_temporary: callback.isTemporary,
      },
    );
    if (error) {
      console.error(LOG_TAG, {
        event: "record_failed",
        transactionId: callback.transactionId,
        error: describeSupabaseError(error),
      });
      return reject(500, "Server error");
    }

    const result = data as {
      ref: number | null;
      matched: boolean;
      duplicate: boolean;
      temporary: boolean;
      reason: string | null;
    };
    if (result.duplicate || !result.matched) {
      console.warn(LOG_TAG, {
        event: result.duplicate ? "duplicate_delivery" : "not_matched",
        reason: result.reason,
        kind: callback.kind,
        transactionId: callback.transactionId,
        kevaId: callback.kevaId,
        param2: callback.param2,
      });
    }
    if (result.temporary && !result.duplicate) {
      console.warn(LOG_TAG, {
        event: "temporary_transaction",
        transactionId: callback.transactionId,
        solek: callback.solek,
        param2: callback.param2,
      });
    }
    return NextResponse.json(
      result.matched && typeof result.ref === "number"
        ? { WEBDocID: result.ref }
        : {},
    );
  } catch (error) {
    console.error(LOG_TAG, { event: "unexpected_error", error });
    return reject(500, "Server error");
  }
}
