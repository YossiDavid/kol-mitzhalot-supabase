import { createClient } from "@/lib/supabase/server";

export const PHONE_VERIFICATION_SETTING_KEY = "phone_verification_enabled";

/**
 * Whether the phone OTP verification gate is active (layout + OTP APIs).
 * Defaults to true if the row is missing or the query fails (safe for existing deployments).
 */
export async function getPhoneVerificationEnabled(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", PHONE_VERIFICATION_SETTING_KEY)
      .maybeSingle();

    if (error || data == null) return true;
    return data.value === true;
  } catch {
    return true;
  }
}
