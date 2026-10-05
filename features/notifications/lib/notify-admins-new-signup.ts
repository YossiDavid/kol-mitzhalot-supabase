import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { readTemplateId, sendEmail } from "@/lib/email/send-email";
import {
  ADMIN_NEW_SIGNUP_TEMPLATE_ENV,
  buildAdminNewSignupEmail,
} from "@/lib/email/templates/admin-new-signup";

/**
 * כמה זמן "תפיסה" של שליחה נחשבת בתוקף. תפיסה שנתקעה (התהליך קרס אחרי
 * התפיסה ולפני הסיום) נעשית זמינה לתפיסה מחדש אחרי זמן זה.
 */
const CLAIM_TTL_MS = 10 * 60 * 1000;
/** משתמש שנרשם לפני יותר מזה לא ייחשב "הרשמה חדשה" לעולם */
const MAX_SIGNUP_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const TAG = "[admin-new-signup-email]";

/**
 * תפיסה אטומית של זכות השליחה למשתמש: UPDATE בהצהרה אחת שמצליחה לכל היותר
 * לתהליך אחד. שורת הסימון נוצרת בטריגר ההרשמה (ממתינה), והיא היחידה שמקנה
 * זכות שליחה - לכן משתמשים קיימים (שסומנו כנשלחו במיגרציה) לעולם לא יפעילו מייל.
 */
async function claimSignupEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const now = Date.now();
  const { data, error } = await admin
    .from("signup_admin_notifications")
    .update({ claimed_at: new Date(now).toISOString() })
    .eq("user_id", userId)
    .is("sent_at", null)
    .gt("created_at", new Date(now - MAX_SIGNUP_AGE_MS).toISOString())
    .or(
      `claimed_at.is.null,claimed_at.lt.${new Date(now - CLAIM_TTL_MS).toISOString()}`,
    )
    .select("user_id");

  if (error) {
    console.error(`${TAG}: תפיסת השליחה נכשלה`, error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** סיום: נשלח = סימון סופי; לא נשלח = שחרור התפיסה כדי שכניסה הבאה תנסה שוב */
async function finishSignupEmail(
  admin: SupabaseClient,
  userId: string,
  wasSent: boolean,
): Promise<void> {
  const { error } = await admin
    .from("signup_admin_notifications")
    .update(
      wasSent ? { sent_at: new Date().toISOString() } : { claimed_at: null },
    )
    .eq("user_id", userId);

  if (error) {
    console.error(`${TAG}: עדכון סימון השליחה נכשל`, error.message);
  }
}

async function loadAdminEmails(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.rpc("get_admin_emails");
  if (error) throw new Error(`שליפת מיילי המנהלים נכשלה: ${error.message}`);
  return ((data ?? []) as { email: string | null }[])
    .map((row) => row.email?.trim())
    .filter((email): email is string => Boolean(email));
}

/**
 * מודיע במייל לכל המנהלים על משתמש חדש. נקרא מנקודת האימות הראשונה בשרת
 * (/auth/confirm) בתוך after(), ולכן אינו מעכב ואינו מכשיל את הכניסה.
 * לעולם לא זורק. אידמפוטנטי: מייל אחד לכל היותר לכל משתמש.
 */
export async function notifyAdminsOfNewSignup(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    if (!(await claimSignupEmail(admin, userId))) return;

    let wasSent = false;
    try {
      wasSent = await sendToAdmins(admin, userId);
    } finally {
      await finishSignupEmail(admin, userId, wasSent);
    }
  } catch (error) {
    console.error(`${TAG}: שגיאה לא צפויה`, error);
  }
}

/** true רק אם לפחות מנהל אחד קיבל בפועל; skipped (פיתוח) אינו נחשב שליחה */
async function sendToAdmins(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  const user = userData?.user;
  if (error || !user) {
    console.error(`${TAG}: המשתמש לא נמצא`, error?.message);
    return false;
  }

  const meta = user.user_metadata ?? {};
  const fullName = [meta.firstName, meta.lastName]
    .filter((part): part is string => typeof part === "string" && !!part.trim())
    .join(" ");
  const content = buildAdminNewSignupEmail({
    userId,
    fullName: fullName || null,
    email: user.email ?? null,
    phone: typeof meta.phone === "string" ? meta.phone : null,
  });
  const templateId = readTemplateId(ADMIN_NEW_SIGNUP_TEMPLATE_ENV);

  const recipients = await loadAdminEmails(admin);
  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
        templateId,
        dynamicData: content.dynamicData,
      }),
    ),
  );

  results.forEach((result) => {
    if (!result.ok) console.error(`${TAG}: שליחה למנהל נכשלה`, result.error);
  });
  return results.some((result) => result.ok && !result.skipped);
}
