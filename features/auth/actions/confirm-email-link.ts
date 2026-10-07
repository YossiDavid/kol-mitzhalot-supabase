"use server";

import { redirect } from "next/navigation";

import {
  buildAuthErrorPath,
  normalizeErrorCode,
} from "@/features/auth/lib/auth-error";
import { confirmLinkSchema } from "@/features/auth/lib/email-auth-schema";
import { sanitizeNextPath } from "@/features/auth/lib/next-path";
import { scheduleNewSignupAdminEmail } from "@/features/auth/lib/schedule-signup-email";
import { createClient } from "@/lib/supabase/server";

/**
 * אימות הקישור מהמייל — רץ רק כשהמשתמש לוחץ על הכפתור במסך האישור.
 *
 * ה-GET של הקישור רק מציג את המסך (ראו features/auth/components/confirm-link-page),
 * כך שסורק קישורים (מסנן אינטרנט, הגנת Gmail) שפותח את הכתובת מראש לא צורך את
 * האסימון חד-הפעמי. אין כאן logging של האסימון.
 *
 * מקבל שני צורות: `token_hash` (+`type`) — הקישור לדומיין שלנו; ו-`code` —
 * קישור ישן של PKCE שהספק כבר המיר ל-code.
 */
export async function confirmEmailLinkAction(
  formData: FormData,
): Promise<never> {
  const parsed = confirmLinkSchema.safeParse({
    token_hash: formData.get("token_hash") ?? undefined,
    type: formData.get("type") ?? undefined,
    code: formData.get("code") ?? undefined,
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    redirect(buildAuthErrorPath({ code: "missing_params" }));
  }

  const { token_hash, type, code } = parsed.data;
  const next = sanitizeNextPath(parsed.data.next);
  const nextForError = next === sanitizeNextPath(null) ? null : next;

  if (!token_hash && !code) {
    redirect(
      buildAuthErrorPath({ code: "missing_params", next: nextForError }),
    );
  }

  const supabase = await createClient();
  const { data, error } = token_hash
    ? await supabase.auth.verifyOtp({ type, token_hash })
    : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    console.error("[auth/confirm] verification failed:", {
      code: error.code,
      status: error.status,
    });
    redirect(
      buildAuthErrorPath({
        code: normalizeErrorCode(error.code),
        text: error.message,
        next: nextForError,
      }),
    );
  }

  scheduleNewSignupAdminEmail(data.user?.id);
  redirect(next);
}
