/**
 * שליפת הקוביות שבתוקף היום, עבור דף הבית ודף התרומות.
 * Callers: components/website/dedications/dedication-tiles-section.tsx.
 *
 * הקריאה אנונימית (בלי cookies), ולכן אפשר לשמור אותה בקאש. התאריך של היום
 * (שעון ישראל) הוא ארגומנט, ולכן חלק ממפתח הקאש: בחצות ישראלי המפתח מתחלף
 * וקובייה שהסתיימה נעלמת (וחדשה מופיעה) בלי שום פעולת מנהל. שינוי של מנהל
 * מפקיע את התג ישירות (updateTag בפעולות הניהול). ה-RLS בנוסף מסנן לפי
 * "היום בישראל" במסד, כרשת ביטחון.
 */
import { cacheLife, cacheTag } from "next/cache";

import { DEDICATIONS_CACHE_TAG } from "@/features/dedications/lib/dedications-cache";
import {
  PUBLIC_DEDICATION_COLUMNS,
  compareDedications,
  type PublicDedication,
} from "@/features/dedications/lib/dedication-model";
import { ISO_DATE_PATTERN } from "@/features/dedications/lib/israel-date";
import { createClient } from "@/lib/supabase/public";

/** כמה זמן אפשר להגיש קובייה ישנה אחרי שינוי שלא הפקיע את התג (שניות) */
const REVALIDATE_SECONDS = 10;
const STALE_SECONDS = 30;
const EXPIRE_SECONDS = 300;

/** הקוביות שפורסמו ובתוקף ב-`today` (YYYY-MM-DD, שעון ישראל), בסדר התצוגה */
export async function listCurrentDedications(
  today: string,
): Promise<PublicDedication[]> {
  "use cache";
  cacheLife({
    stale: STALE_SECONDS,
    revalidate: REVALIDATE_SECONDS,
    expire: EXPIRE_SECONDS,
  });
  cacheTag(DEDICATIONS_CACHE_TAG);

  // today נכנס למחרוזת מסנן; מאמתים פורמט במקום לסמוך על הקורא
  if (!ISO_DATE_PATTERN.test(today)) {
    throw new Error("DEDICATIONS_INVALID_DATE");
  }

  // אין סינון is_published: RLS מסנן אותו, ולאנונימי אין SELECT על העמודה
  const { data, error } = await createClient()
    .from("dedications")
    .select(PUBLIC_DEDICATION_COLUMNS)
    .lte("starts_on", today)
    .or(`ends_on.is.null,ends_on.gte.${today}`);

  if (error) {
    console.error("[dedications] טעינת הקוביות נכשלה", error);
    throw new Error("DEDICATIONS_FETCH_FAILED");
  }

  return [...((data ?? []) as PublicDedication[])].sort(compareDedications);
}
