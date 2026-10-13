import { createAdminClient } from "@/lib/supabase/admin";

/**
 * האם הכרטיס מושהה ע"י ההנהלה. נשלף בנפרד ורק למנהל מערכת (service role),
 * ולא נכלל ברשימות העמודות של הכרטיס, כדי שלא יגיע לצופים אחרים כלל.
 * הקורא אחראי לוודא שהצופה מנהל. כשל בשליפה: null (בלי בקרת השהיה).
 */
export async function loadCardAdminPaused(
  studentId: string,
): Promise<boolean | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("students")
      .select("admin_paused_at")
      .eq("id", studentId)
      .maybeSingle();
    if (error || !data) {
      console.error("[students/card] admin pause lookup failed", error);
      return null;
    }
    return data.admin_paused_at !== null;
  } catch (error) {
    console.error("[students/card] admin pause lookup failed", error);
    return null;
  }
}
