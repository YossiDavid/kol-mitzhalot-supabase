import type { Route } from "next";

/**
 * תרגום שגיאות אימות (Supabase Auth) להסבר בעברית ולצעד הבא.
 *
 * הטקסט שמגיע ב-query של /auth/error הוא טקסט אנגלי של הספק ונשלט על ידי מי
 * שיוצר את הקישור, ולכן הוא משמש רק לזיהוי הסוג — הוא לעולם לא מוצג. כל מה
 * שהמשתמש רואה הוא ההודעות הקבועות שכאן.
 */

/** כמה תווים נשמרים מהטקסט שבקישור; מעבר לזה זה לא הודעת שגיאה אמיתית */
export const MAX_ERROR_TEXT_LENGTH = 200;

const MAX_ERROR_CODE_LENGTH = 64;
const ERROR_CODE_PATTERN = /^[a-z0-9_]+$/;

/** מעל זה כנראה שזו לא שהיית חסימה אמיתית אלא ערך מעוות */
const MAX_RATE_LIMIT_SECONDS = 3600;

export type AuthErrorKind =
  | "expired"
  | "denied"
  | "pkce"
  | "rateLimit"
  | "signupDisabled"
  | "missingParams"
  | "generic";

export type AuthErrorInfo = {
  kind: AuthErrorKind;
  title: string;
  /** הסבר בעברית; משפט או שניים */
  message: string;
  /** האם להציע הקלדת קוד מאותו מייל */
  offerCode: boolean;
  /** האם להציע בקשת קישור חדש (הרשמה במקום התחברות כש-signupDisabled) */
  offerNewLink: boolean;
};

/** חותך טקסט חופשי מה-query לאורך סביר */
export function capErrorText(raw: string | null | undefined): string {
  return (raw ?? "").slice(0, MAX_ERROR_TEXT_LENGTH);
}

/** קוד שגיאה תקין (`otp_expired`) או null; כל דבר אחר נזרק */
export function normalizeErrorCode(
  raw: string | null | undefined,
): string | null {
  const code = (raw ?? "").trim().toLowerCase();
  if (!code || code.length > MAX_ERROR_CODE_LENGTH) return null;
  return ERROR_CODE_PATTERN.test(code) ? code : null;
}

function parseRateLimitSeconds(text: string): number | null {
  const match = /after (\d+) seconds?/i.exec(text);
  if (!match) return null;
  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds, MAX_RATE_LIMIT_SECONDS);
}

function detectKind(code: string | null, text: string): AuthErrorKind {
  if (code === "otp_expired" || code === "flow_state_expired") return "expired";
  if (code === "over_email_send_rate_limit") return "rateLimit";
  if (code === "over_request_rate_limit") return "rateLimit";
  if (code === "signup_disabled" || code === "otp_disabled") {
    return "signupDisabled";
  }
  if (code === "flow_state_not_found" || code === "bad_code_verifier") {
    return "pkce";
  }
  if (code === "missing_params") return "missingParams";

  if (/code verifier/i.test(text)) return "pkce";
  if (/has expired|is invalid|expired or is invalid|otp_expired/i.test(text)) {
    return "expired";
  }
  if (/only request this after|rate limit/i.test(text)) return "rateLimit";
  if (/signups? not allowed/i.test(text)) return "signupDisabled";
  if (code === "access_denied" || /access_denied|access denied/i.test(text)) {
    return "denied";
  }
  return "generic";
}

const EXPIRED_MESSAGE =
  "הקישור כבר נוצל, פג תוקפו, או שנפתח לפניך על ידי מסנן אינטרנט או תוכנת " +
  "הגנה של המייל (הם פותחים קישורים מראש כדי לבדוק אותם, וקישור כניסה " +
  "תקף רק לפתיחה אחת). אפשר להיכנס עם הקוד שבאותו מייל, או לבקש קישור חדש.";

/** ההסבר וההצעות למשתמש, לפי סוג השגיאה */
export function describeAuthError(input: {
  code?: string | null;
  text?: string | null;
}): AuthErrorInfo {
  const code = normalizeErrorCode(input.code);
  const text = capErrorText(input.text);
  const kind = detectKind(code, text);

  switch (kind) {
    case "expired":
      return {
        kind,
        title: "הקישור כבר אינו תקף",
        message: EXPIRED_MESSAGE,
        offerCode: true,
        offerNewLink: true,
      };
    case "denied":
      return {
        kind,
        title: "הכניסה לא אושרה",
        message:
          "הקישור לא אושר: ייתכן שכבר נוצל או שפג תוקפו. אפשר להיכנס עם הקוד " +
          "שבמייל, או לבקש קישור חדש.",
        offerCode: true,
        offerNewLink: true,
      };
    case "pkce":
      return {
        kind,
        title: "הקישור נפתח בדפדפן אחר",
        message:
          "הקישור נפתח בדפדפן או במכשיר שונים מאלה שבהם התבקשה הכניסה. אפשר " +
          "להיכנס עם הקוד שבאותו מייל, או לבקש קישור חדש ולפתוח אותו באותו " +
          "דפדפן.",
        offerCode: true,
        offerNewLink: true,
      };
    case "rateLimit": {
      const seconds = parseRateLimitSeconds(text);
      const wait = seconds
        ? `אפשר לבקש קישור חדש רק אחרי ${seconds} שניות.`
        : "נשלחו יותר מדי בקשות, נא להמתין מעט לפני בקשה חדשה.";
      return {
        kind,
        title: "נשלחו יותר מדי בקשות",
        message: `${wait} בינתיים אפשר להיכנס עם הקוד מהמייל האחרון שקיבלת.`,
        offerCode: true,
        offerNewLink: true,
      };
    }
    case "signupDisabled":
      return {
        kind,
        title: "לא נמצא חשבון",
        message: "לא נמצא חשבון עם כתובת המייל הזו. יש להירשם תחילה.",
        offerCode: false,
        offerNewLink: false,
      };
    case "missingParams":
      return {
        kind,
        title: "הקישור חסר פרטים",
        message:
          "הקישור שנפתח אינו שלם (ייתכן שהועתק חלקית). נא ללחוץ על הכפתור במייל, " +
          "או להיכנס עם הקוד שבו.",
        offerCode: true,
        offerNewLink: true,
      };
    default:
      return {
        kind: "generic",
        title: "משהו השתבש",
        message:
          "לא הצלחנו להשלים את הכניסה. אפשר לנסות להיכנס עם הקוד מהמייל, או " +
          "לבקש קישור חדש.",
        offerCode: true,
        offerNewLink: true,
      };
  }
}

/**
 * כתובת דף השגיאה: קוד + טקסט קצר לזיהוי, ו-next מסונן אם יש. מסומנת כ-`Route`
 * (typedRoutes) כי ה-query נבנה בזמן ריצה.
 */
export function buildAuthErrorPath(input: {
  code?: string | null;
  text?: string | null;
  next?: string | null;
}): Route {
  const params = new URLSearchParams();
  const code = normalizeErrorCode(input.code);
  if (code) params.set("code", code);
  const text = capErrorText(input.text);
  if (text) params.set("error", text);
  if (input.next) params.set("next", input.next);
  const query = params.toString();
  return (query ? `/auth/error?${query}` : "/auth/error") as Route;
}
