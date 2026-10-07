import { after } from "next/server";

import { notifyAdminsOfNewSignup } from "@/features/notifications/lib/notify-admins-new-signup";

/**
 * מייל למנהלים על הרשמה חדשה. רץ אחרי שליחת התגובה (after), ולכן אינו מעכב
 * ואינו יכול להכשיל את הכניסה; notifyAdminsOfNewSignup אינו זורק, והוא
 * אידמפוטנטי (מייל אחד לכל היותר לכל משתמש), כך שנקרא בכל כניסה בלי חשש.
 */
export function scheduleNewSignupAdminEmail(userId: string | undefined): void {
  if (!userId) return;
  after(() => notifyAdminsOfNewSignup(userId));
}
