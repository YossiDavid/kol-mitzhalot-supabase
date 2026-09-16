/**
 * שיתוף כרטיס מיועד. הסדר: דיאלוג השיתוף של המכשיר (מובייל), ואם אינו זמין
 * או שהמשתמש ביטל - העתקת הקישור ללוח. אם גם היא נחסמה, הקישור נפתח
 * בלשונית חדשה כדי שאפשר יהיה להעתיק אותו ידנית.
 *
 * הפונקציה ניגשת ל-window ול-navigator, ולכן היא לשימוש בקוד לקוח בלבד.
 */
export type ShareCardResult = "shared" | "copied" | "opened";

export function studentCardShareUrl(studentId: string): string {
  return `${window.location.origin}/app/students/${studentId}`;
}

export async function shareStudentCard(
  studentId: string,
  studentName?: string,
): Promise<ShareCardResult> {
  const url = studentCardShareUrl(studentId);
  const title = studentName
    ? `כרטיס שידוכים — ${studentName}`
    : "כרטיס שידוכים";

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch {
      // ביטול של המשתמש או חסימה של הדפדפן - ממשיכים להעתקה ללוח
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return "opened";
  }
}
