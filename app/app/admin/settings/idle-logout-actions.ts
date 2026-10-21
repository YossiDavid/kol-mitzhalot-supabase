"use server";

/**
 * Callers: features/idle-logout/components/idle-logout-form.tsx.
 * שמירת זמן ההתנתקות האוטומטית (system_settings.text_value, בדקות): בדיקת
 * מנהל, אימות zod, וכתיבה עם service role (למשתמשים אין מדיניות כתיבה על
 * הטבלה). גם 0 (כבוי) נשמר כשורה - בלי שורה חלה ברירת המחדל.
 */

import {
  IDLE_LOGOUT_MESSAGES,
  IDLE_LOGOUT_SETTING_KEY,
  idleLogoutMinutesSchema,
} from "@/features/idle-logout/lib/idle-logout-model";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, hasRole } from "@/lib/user";

export type IdleLogoutActionResult =
  | { ok: true; minutes: number }
  | { ok: false; message: string };

export async function saveIdleLogoutMinutes(
  input: unknown,
): Promise<IdleLogoutActionResult> {
  const user = await getUser();
  if (!hasRole(user, "admin")) {
    return { ok: false, message: IDLE_LOGOUT_MESSAGES.forbidden };
  }

  const parsed = idleLogoutMinutesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? IDLE_LOGOUT_MESSAGES.saveFailed,
    };
  }
  const minutes = parsed.data;

  try {
    const { error } = await createAdminClient()
      .from("system_settings")
      .upsert(
        {
          key: IDLE_LOGOUT_SETTING_KEY,
          text_value: String(minutes),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    if (error) throw error;
  } catch (error) {
    console.error("[idle-logout] שמירת ההגדרה נכשלה", error);
    return { ok: false, message: IDLE_LOGOUT_MESSAGES.saveFailed };
  }

  return { ok: true, minutes };
}
