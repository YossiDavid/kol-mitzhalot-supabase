// /lib/micropay
// ממשק Micropay לשליחת OTP: https://www.micropay.co.il/extApi/sendOtp.php
// פרמטרים ב־lowercase; שליחה ב־GET עם get=1; אימות עם code בלבד (בלי validate).

export type MicroPayResponse =
  | "ERROR"
  | "CODE_SENT"
  | "CODE_VALID"
  | "WRONG_CODE"
  | "MAX_SENT";

type MicropayMode = "get" | "validate";

export type MicroPayResult = {
  status: MicroPayResponse;
  errorMessage?: string;
};

function parseMicropayResponse(raw: string): MicroPayResult {
  const text = (raw ?? "").replace(/^\uFEFF/, "").trim();

  // ERROR --> Description: ...
  const errorMatch = text.match(/^ERROR\s*-->\s*Description:\s*(.*)$/i);
  if (errorMatch) {
    return { status: "ERROR", errorMessage: errorMatch[1].trim() };
  }

  // ERROR <reason>
  if (text.startsWith("ERROR ")) {
    return { status: "ERROR", errorMessage: text.slice(6).trim() };
  }

  switch (text) {
    case "CODE_SENT":
    case "CODE_VALID":
    case "WRONG_CODE":
    case "MAX_SENT":
      return { status: text as MicroPayResponse };
  }

  console.warn("[Micropay] Unexpected response:", text);
  return { status: "ERROR", errorMessage: text };
}

/**
 * שומר '05XXXXXXXX' כמו שהוא.
 * ממיר '+9725XXXXXXXX' ל-'9725XXXXXXXX'.
 * אם הגיע '9725XXXXXXXX' – נשאר.
 * מסיר תווים לא-ספרתיים, אבל לא מוחק אפס מוביל של פורמט מקומי.
 */
function formatForMicropay(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+972")) return digits.replace("+", "");
  if (digits.startsWith("972")) return digits;
  // לוקאלי
  const onlyDigits = raw.replace(/[^\d]/g, "");
  return onlyDigits; // ישאיר 05XXXXXXXX בדיוק
}

export async function callMicropay(
  mode: MicropayMode,
  phone: string,
  code?: string,
): Promise<MicroPayResult> {
  const token = process.env.MICROPAY_TOKEN;
  if (!token) {
    console.error("[Micropay] MICROPAY_TOKEN is not set");
    return { status: "ERROR", errorMessage: "SMS service not configured" };
  }
  const params = new URLSearchParams();
  params.set("token", token);
  params.set("phone", formatForMicropay(phone));

  if (mode === "get") {
    const vmsFrom = process.env.MICROPAY_VMSFROM;
    if (!vmsFrom) {
      console.error("[Micropay] MICROPAY_VMSFROM is not set");
      return { status: "ERROR", errorMessage: "SMS service not configured" };
    }
    params.set("get", "1");
    params.set("type", "vms"); // sms | vms | auto
    params.set("vmsfrom", vmsFrom);
  } else {
    // לפנייה שנייה – אימות הקוד: get=1, token, phone, code (לפי דוק׳ Micropay)
    params.set("get", "1");
    if (code) params.set("code", code.trim());
  }

  const baseUrl = process.env.MICROPAY_URL;
  if (!baseUrl) {
    console.error("[Micropay] MICROPAY_URL is not set");
    return { status: "ERROR", errorMessage: "SMS service not configured" };
  }
  const url = `${baseUrl}?${params.toString()}`;

  const timeoutMs = 15_000; // 15s so serverless doesn't timeout first
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const rawText = await res.text();

    const masked = phone.replace(/(\d{3})\d+(\d{2})/, "$1******$2");
    console.log(
      `[Micropay] HTTP ${res.status} mode=${mode} phone=${masked} body=${rawText.slice(0, 300)}`,
    );

    const parsed = parseMicropayResponse(rawText);

    if (!res.ok) {
      console.warn(
        `[Micropay] Non-OK HTTP ${res.status} body=${rawText.slice(0, 300)}`,
      );
    }
    return parsed;
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.error(
      "[Micropay] request failed",
      isAbort ? "timeout" : err,
    );
    return {
      status: "ERROR",
      errorMessage: isAbort ? "SMS service timeout" : "REQUEST_FAILED",
    };
  }
}

// עטיפות ישנות, אם אתה צריך API שמחזיר רק status:
export async function sendOtp(phone: string): Promise<MicroPayResponse> {
  const { status } = await callMicropay("get", phone);
  return status;
}
export async function validateOtp(
  phone: string,
  code: string,
): Promise<MicroPayResponse> {
  const { status } = await callMicropay("validate", phone, code);
  return status;
}
