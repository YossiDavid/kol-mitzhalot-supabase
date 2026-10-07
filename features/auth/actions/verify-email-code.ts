"use server";

import { redirect } from "next/navigation";

import { describeAuthError } from "@/features/auth/lib/auth-error";
import {
  emailCodeSchema,
  type EmailCodeInput,
} from "@/features/auth/lib/email-auth-schema";
import { sanitizeNextPath } from "@/features/auth/lib/next-path";
import { scheduleNewSignupAdminEmail } from "@/features/auth/lib/schedule-signup-email";
import { createClient } from "@/lib/supabase/server";

export type VerifyEmailCodeResult = { ok: false; message: string };

const INVALID_INPUT_MESSAGE =
  "נא להזין את כתובת האימייל ואת הקוד שבמייל (ספרות בלבד, 6 ספרות).";
const WRONG_CODE_MESSAGE =
  "הקוד שגוי או שפג תוקפו. הקוד תקף רק במייל האחרון שנשלח אליכם. אפשר לבקש קישור וקוד חדשים.";

/**
 * כניסה עם הקוד בן הספרות מהמייל (`{{ .Token }}`): חלופה לקישור, שסורקי
 * קישורים לא יכולים לצרוך, כי הקוד אינו כתובת שנפתחת מעצמה.
 *
 * מצליח → הפניה ליעד (לא חוזר). נכשל → מחזיר הודעה בעברית להצגה בטופס.
 * `type: 'email'` מתאים גם לקישור כניסה וגם לקוד של הרשמה חדשה.
 */
export async function verifyEmailCodeAction(
  input: EmailCodeInput,
): Promise<VerifyEmailCodeResult> {
  const parsed = emailCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: INVALID_INPUT_MESSAGE };
  }

  const { email, code, next } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });

  if (error || !data.user) {
    console.error("[auth/code] verification failed:", {
      code: error?.code,
      status: error?.status,
    });
    const isRateLimited =
      describeAuthError({ code: error?.code, text: error?.message }).kind ===
      "rateLimit";
    return {
      ok: false,
      message: isRateLimited
        ? "בוצעו יותר מדי ניסיונות. נא להמתין מעט ולנסות שוב."
        : WRONG_CODE_MESSAGE,
    };
  }

  scheduleNewSignupAdminEmail(data.user.id);
  redirect(sanitizeNextPath(next));
}
