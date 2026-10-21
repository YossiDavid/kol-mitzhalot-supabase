import { cache } from "react";

import {
  IDLE_LOGOUT_DEFAULT_MINUTES,
  IDLE_LOGOUT_SETTING_KEY,
  parseIdleLogoutMinutes,
} from "@/features/idle-logout/lib/idle-logout-model";
import { createClient } from "@/lib/supabase/server";

/**
 * כמה דקות של חוסר פעילות עד התנתקות אוטומטית (0 = כבוי).
 * Callers: app/app/layout.tsx, הגדרות המנהל.
 *
 * כמו getPhoneVerificationEnabled: ממוזכר לבקשה בלבד, בלי מטמון בין בקשות -
 * שינוי של המנהל נכנס לתוקף בטעינה הבאה. לא נזרק: כשל = ברירת המחדל.
 */
export const getIdleLogoutMinutes = cache(async (): Promise<number> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("text_value")
      .eq("key", IDLE_LOGOUT_SETTING_KEY)
      .maybeSingle();

    if (error) {
      console.error("[idle-logout] טעינת ההגדרה נכשלה", error);
      return IDLE_LOGOUT_DEFAULT_MINUTES;
    }
    return parseIdleLogoutMinutes(data?.text_value);
  } catch (error) {
    console.error("[idle-logout] טעינת ההגדרה נכשלה", error);
    return IDLE_LOGOUT_DEFAULT_MINUTES;
  }
});
