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
    const { data, error } = await createAdminClient().auth.admin.getUserById(
      userId,
    );
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
