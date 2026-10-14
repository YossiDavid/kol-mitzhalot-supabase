import { unstable_noStore as noStore } from "next/cache";

import { ContactEmailForm } from "@/features/contact-email/components/contact-email-form";
import { CONTACT_EMAIL_SETTING_KEY } from "@/features/contact-email/lib/contact-email-model";
import { createClient } from "@/lib/supabase/server";

/**
 * ההגדרה בעמוד ההגדרות של המנהל. הערך הנוכחי נקרא בלי קאש (מנהלים מחוברים
 * רשאים לקרוא את system_settings), כדי שהטופס תמיד יציג את מה ששמור.
 */
export async function ContactEmailSetting() {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("text_value")
    .eq("key", CONTACT_EMAIL_SETTING_KEY)
    .maybeSingle();

  if (error) console.error("[contact-email] טעינת ההגדרה נכשלה", error);

  return <ContactEmailForm initialEmail={data?.text_value ?? ""} />;
}
