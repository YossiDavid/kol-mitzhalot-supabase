import type { SupabaseClient } from "@supabase/supabase-js";

/** המועדפים נשמרים ב-user_metadata.favorites (מערך מזהי כרטיסים) */
const FAVORITES_METADATA_KEY = "favorites";

/** מנקה את כל המועדפים של המשתמש המחובר. מחזיר הודעת שגיאה, או null בהצלחה */
export async function clearAllFavorites(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({
    data: { [FAVORITES_METADATA_KEY]: [] },
  });
  return error ? error.message : null;
}

/** ניסוח הדיאלוג: כמה מועדפים יוסרו */
export function clearFavoritesMessage(count: number): string {
  return count === 1
    ? "מיועד/ת אחד/ת יוסר/ת מהמועדפים שלך."
    : `${count} מיועדים יוסרו מהמועדפים שלך.`;
}
