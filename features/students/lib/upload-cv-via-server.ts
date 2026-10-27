/**
 * העלאת קו״ח דרך POST /api/v1/students/:id/cv (service role אחרי בדיקת הרשאה).
 * מדיניות האחסון מתירה העלאה ישירה לבעל הכרטיס בלבד, ולכן שדכן או מנהל
 * שמעדכנים קו״ח בכרטיס של מישהו אחר עוברים כאן. הנתיב גם רושם את הכתובת
 * בכרטיס. לשימוש בקוד לקוח.
 */
export type UploadCvResult =
  | { ok: true; cvUrl: string }
  | { ok: false; message: string };

const UPLOAD_FAILED = "העלאת הקובץ נכשלה";

async function readErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "error" in body) {
    const { error } = body as { error: unknown };
    if (typeof error === "string" && error) return error;
  }
  return UPLOAD_FAILED;
}

export async function uploadCvViaServer(
  studentId: string,
  file: File,
): Promise<UploadCvResult> {
  try {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`/api/v1/students/${studentId}/cv`, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response) };
    }
    const { cvUrl } = (await response.json()) as { cvUrl: string };
    return { ok: true, cvUrl };
  } catch (error) {
    console.error("[students/cv] upload request failed:", error);
    return {
      ok: false,
      message: "העלאת הקובץ נכשלה. בדקו את החיבור ונסו שוב.",
    };
  }
}
