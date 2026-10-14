/**
 * האימייל הציבורי של המערכת לתחתית הדפים.
 * Callers: components/layout/contact-email.tsx, מסך ההגדרות של המנהל.
 *
 * הקריאה אנונימית (בלי cookies) דרך הפונקציה הצרה get_contact_email, ולכן אפשר
 * לשמור אותה בקאש (Cache Components): התחתית נמצאת בכל דף ציבורי. שינוי של
 * מנהל מפקיע את התג מיד (updateTag בפעולת השמירה). כרשת ביטחון, גם בלי הפקעה
 * הערך מתרענן אחרי REVALIDATE_SECONDS.
 */
import { cacheLife, cacheTag } from "next/cache";

import {
  CONTACT_EMAIL_CACHE_TAG,
  contactEmailSchema,
} from "@/features/contact-email/lib/contact-email-model";
import { createClient } from "@/lib/supabase/public";

const REVALIDATE_SECONDS = 60;
const STALE_SECONDS = 30;
const EXPIRE_SECONDS = 3600;

/** הכתובת שהוגדרה, או null כשאין. זורק בכשל קריאה (כשל לא נשמר בקאש) */
async function fetchContactEmail(): Promise<string | null> {
  "use cache";
  cacheLife({
    stale: STALE_SECONDS,
    revalidate: REVALIDATE_SECONDS,
    expire: EXPIRE_SECONDS,
  });
  cacheTag(CONTACT_EMAIL_CACHE_TAG);

  const { data, error } = await createClient().rpc("get_contact_email");
  if (error) {
    console.error("[contact-email] טעינת האימייל נכשלה", error);
    throw new Error("CONTACT_EMAIL_FETCH_FAILED");
  }

  // לא סומכים על הנתון: כתובת לא תקינה (למשל עריכה ידנית בבסיס הנתונים)
  // לא מוצגת בתחתית
  const parsed = contactEmailSchema.safeParse(data ?? "");
  return parsed.success && parsed.data ? parsed.data : null;
}

/** כשל בקריאה = אין שורה בתחתית; הדף עצמו לא נופל בגלל התחתית */
export async function getContactEmail(): Promise<string | null> {
  try {
    return await fetchContactEmail();
  } catch {
    return null;
  }
}
