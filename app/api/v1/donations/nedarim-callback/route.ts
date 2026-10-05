/**
 * Callers: שרתי נדרים פלוס בלבד (POST אחד לאחר עסקה מוצלחת, ללא ניסיון חוזר).
 * ציבורי (אין סשן): ההרשאה היא חתימת ה-HMAC על הגוף הגולמי. נכשל סגור.
 * מתעד אידמפוטנטית, מתאים ל-Param2 ומסמן "שולם" דרך record_nedarim_payment
 * (עסקה זמנית, בלי Confirmation, נרשמת אך לא מסומנת שולם).
 * מחזיר {WEBDocID: ref} כשהותאם, אחרת {}. רץ ב-Node (ברירת המחדל; export runtime אסור עם
 * cacheComponents), כי האימות משתמש ב-node:crypto.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { parseNedarimCallback } from "@/features/donations/lib/parse-callback";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyNedarimSignature,
} from "@/features/donations/lib/verify-webhook";
import { isKnownNedarimIp } from "@/features/donations/lib/webhook-ips";

const LOG_TAG = "[donations/webhook]";
/** גוף עדכון אמיתי הוא כמה KB; מעל זה אין טעם אפילו לחשב חתימה */
const MAX_BODY_BYTES = 64 * 1024;

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

  const callback = parseNedarimCallback(rawBody);
  if (!callback) {
    console.warn(LOG_TAG, { event: "unrecognized_body", ip });
    return reject(400, "Unrecognized payload");
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
