import type { NextRequest } from "next/server";

/**
 * כתובת ה-IP של הלקוח. אותה גזירה כמו ב-/api/v1/auth/otp/send: הכניסה הראשונה
 * ב-x-forwarded-for, ואז x-real-ip. ב-Vercel ה-header נכתב על ידי הפלטפורמה
 * (לקוח אינו יכול להזריק אליו), ולכן אפשר להסתמך עליו.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const [first] = forwarded?.split(",") ?? [];
  if (first?.trim()) return first.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
