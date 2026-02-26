// /lib/micropay

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
  const params = new URLSearchParams();
  params.set("token", process.env.MICROPAY_TOKEN!);
  params.set("phone", formatForMicropay(phone));

  if (mode === "get") {
    params.set("get", "1");
    params.set("type", "vms"); // sms | vms | auto
    params.set("vmsfrom", process.env.MICROPAY_VMSFROM!); // vms | sms | auto
  } else {
    params.set("get", "1");
    params.set("validate", "1");
    if (code) params.set("code", code.trim());
  }

  const url = `${process.env.MICROPAY_URL}?${params.toString()}`;

  try {
    const res = await fetch(url, { method: "GET" });
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
    console.error("Micropay request failed", err);
    return { status: "ERROR", errorMessage: "REQUEST_FAILED" };
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
