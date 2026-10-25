import { createClient } from "@/lib/supabase/server";

/**
 * האם המשתמש המחובר רשאי לצפות ברשימת השדכנים ולפנות אליהם: שדכן, מנהל,
 * איש צוות, או בעל כרטיס פעיל שגלוי לכל השדכנים (can_browse_shadchanim).
 * כשל בבדיקה נחשב "לא רשאי" - הפנייה עצמה נאכפת שוב במסד.
 */
export async function canBrowseShadchanim(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_browse_shadchanim");
  if (error) {
    console.error("[shadchanim/browse-access]", error.message);
    return false;
  }
  return data === true;
}
