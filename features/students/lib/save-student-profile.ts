import { describeStudentSaveError } from "./save-error-message";
import type { StudentPayload } from "./build-student-payload";

/**
 * שמירת כרטיס דרך השרת שלנו: הדפדפן לא פונה ל-*.supabase.co לשמירה, כי סינון
 * אינטרנט שמחליף את התשובה בדף HTML שבר את הקריאה הישירה. הצורה { data, error }
 * זהה לזו של supabase.rpc, כדי שהזרימות שמסביב יישארו כפי שהן.
 */

const CREATE_URL = "/api/v1/students";
const updateUrl = (studentId: string) =>
  `/api/v1/students/${encodeURIComponent(studentId)}/profile`;

const LOGIN_REQUIRED_MESSAGE = "שגיאה: יש להתחבר למערכת";
const TOO_LARGE_MESSAGE = "הכרטיס גדול מדי לשמירה. כדאי לקצר טקסטים ארוכים.";
const TOO_MANY_REQUESTS_MESSAGE = "יותר מדי ניסיונות שמירה. נסו שוב בעוד דקה.";

/** כשל שמירה שאינו מוכר: הודעת המסד הגולמית נרשמת בקונסול ולא מוצגת למשתמש */
const GENERIC_SAVE_FAILURE_MESSAGE =
  "שמירת הכרטיס נכשלה. אפשר לנסות שוב, ואם התקלה חוזרת פנו אלינו דרך עמוד צרו קשר.";

const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_TOO_MANY_REQUESTS = 429;

/** הודעות ה-RPC עצמן הן מזהים טכניים; כאן הן הופכות לעברית */
const RPC_MESSAGES: Readonly<Record<string, string>> = {
  authentication_required: LOGIN_REQUIRED_MESSAGE,
  not_allowed: "אין הרשאה לערוך כרטיס זה",
  student_not_found: "הכרטיס לא נמצא",
};

export type SaveStudentResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };

const failure = (message: string): SaveStudentResult<never> => ({
  data: null,
  error: { message },
});

function messageForStatus(status: number): string | null {
  if (status === HTTP_UNAUTHORIZED) return LOGIN_REQUIRED_MESSAGE;
  if (status === HTTP_PAYLOAD_TOO_LARGE) return TOO_LARGE_MESSAGE;
  if (status === HTTP_TOO_MANY_REQUESTS) return TOO_MANY_REQUESTS_MESSAGE;
  return null;
}

type ParsedResponse =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; message: string };

/** תשובה שאינה JSON (דף חסימה של מסנן, שגיאת שער) לעולם לא מגיעה למשתמש גולמית */
async function parseResponse(response: Response): Promise<ParsedResponse> {
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    const statusMessage = messageForStatus(response.status);
    if (statusMessage) return { ok: false, message: statusMessage };
    return {
      ok: false,
      message: describeStudentSaveError(
        error instanceof Error ? error.message : String(error),
      ),
    };
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      ok: false,
      message: describeStudentSaveError("Unexpected token"),
    };
  }
  return { ok: true, body: body as Record<string, unknown> };
}

async function send(
  url: string,
  method: "POST" | "PUT",
  payload: StudentPayload,
): Promise<SaveStudentResult<Record<string, unknown>>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload }),
    });
  } catch (error) {
    return failure(
      describeStudentSaveError(
        error instanceof Error ? error.message : String(error),
      ),
    );
  }

  const parsed = await parseResponse(response);
  if (!parsed.ok) return failure(parsed.message);

  if (!response.ok) {
    const serverMessage =
      typeof parsed.body.error === "string" ? parsed.body.error : "";
    const knownMessage =
      messageForStatus(response.status) ?? RPC_MESSAGES[serverMessage];
    if (knownMessage) return failure(knownMessage);

    // הודעת השרת עצמה (לרוב טקסט גולמי מהמסד) לא מוצגת: רק הנחיה קבועה
    console.error("[students/save] rejected", response.status, serverMessage);
    const described = describeStudentSaveError(serverMessage);
    return failure(
      described === serverMessage ? GENERIC_SAVE_FAILURE_MESSAGE : described,
    );
  }
  return { data: parsed.body, error: null };
}

/** יוצר כרטיס; מחזיר את מזהה הכרטיס החדש */
export async function createStudentProfile(
  payload: StudentPayload,
): Promise<SaveStudentResult<string>> {
  const result = await send(CREATE_URL, "POST", payload);
  if (result.error) return result;
  const id = result.data.id;
  return typeof id === "string"
    ? { data: id, error: null }
    : failure("שגיאה: לא התקבל מזהה כרטיס");
}

/** מעדכן כרטיס קיים */
export async function updateStudentProfile(
  studentId: string,
  payload: StudentPayload,
): Promise<SaveStudentResult<true>> {
  const result = await send(updateUrl(studentId), "PUT", payload);
  return result.error ? result : { data: true, error: null };
}
