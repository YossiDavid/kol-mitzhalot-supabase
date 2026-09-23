import type { EndorsementSlide } from "@/components/website/endorsements-carousel";
import { createClient } from "@/lib/supabase/server";

/**
 * הסכמות הרבנים המפורסמות, עבור עמודי האתר התדמיתי.
 * הקוראים: דף הבית, אודות, הורים, שדכנים.
 *
 * שגיאת שאילתה נרשמת ללוג ואינה נבלעת: בלעדיה מקטע ההסכמות פשוט נעלם
 * מהאתר בלי שום סימן לכך שמשהו נכשל.
 */
export async function fetchPublishedEndorsements(): Promise<
  EndorsementSlide[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("endorsements")
    .select("id, rav_name, rav_title, image_url, endorsement_text")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[endorsements] טעינת ההסכמות נכשלה", error);
    return [];
  }

  return data ?? [];
}
