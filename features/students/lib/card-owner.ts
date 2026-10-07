import { createAdminClient } from "@/lib/supabase/admin";
import type { CardOwnerInfo } from "@/features/students/components/card/personal-details-section";

/**
 * אימייל החשבון שבבעלותו הכרטיס, לתצוגת מנהל מערכת בלבד. הקורא אחראי לוודא
 * שהצופה מנהל - הפונקציה משתמשת ב-service role ואינה בודקת זאת בעצמה.
 *
 * כשל בשליפה אינו מפיל את הכרטיס: האימייל חוזר null (מוצג "לא זמין"), והקישור
 * לפרטי המשתמש נשאר.
 */
export async function loadCardOwnerInfo(
  userId: string,
): Promise<CardOwnerInfo> {
  try {
    const { data, error } =
      await createAdminClient().auth.admin.getUserById(userId);
    if (error) {
      console.error("Error fetching card owner email:", error);
      return { userId, email: null };
    }
    return { userId, email: data.user?.email ?? null };
  } catch (error) {
    console.error("Card owner lookup failed:", error);
    return { userId, email: null };
  }
}

/** שם מנהל המערכת שאישר, להצגה ליד האישור. null כשאין מזהה או שהשליפה נכשלה */
export async function loadAdminDisplayName(
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data, error } =
      await createAdminClient().auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    const meta = data.user.user_metadata ?? {};
    const name = [meta.firstName, meta.lastName].filter(Boolean).join(" ");
    return name || data.user.email?.split("@")[0] || null;
  } catch (error) {
    console.error("Approving admin lookup failed:", error);
    return null;
  }
}
