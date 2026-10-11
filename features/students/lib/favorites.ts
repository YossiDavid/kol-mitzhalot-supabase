import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * המועדפים נשמרים ב-user_metadata.favorites (מערך מזהי כרטיסים).
 *
 * כל כתיבה קוראת קודם את המועדפים העדכניים מה-auth ורק אז כותבת, ולא
 * מסתמכת על העתק שמור בלקוח: שני טאבים פתוחים לא דורסים זה את זה מעבר
 * לחלון הקצר שבין הקריאה לכתיבה. (updateUser מחליף את כל המערך, ולכן
 * אין דרך אטומית לעשות זאת בלי פעולה בצד השרת.)
 */
const FAVORITES_METADATA_KEY = "favorites";

export type FavoritesResult = { ok: true; favorites: string[] } | { ok: false };

/** מזהי המועדפים מתוך המשתמש. ערך שאינו מערך מחרוזות נחשב "אין מועדפים" */
export function readFavorites(
  user: Pick<User, "user_metadata"> | null | undefined,
): string[] {
  const value: unknown = user?.user_metadata?.[FAVORITES_METADATA_KEY];
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string");
}

/** הפרטים הטכניים נרשמים בקונסול; לקורא חוזר רק { ok: false } */
function fail(context: string, error: unknown): FavoritesResult {
  console.error(`[favorites] ${context} failed:`, error);
  return { ok: false };
}

/** המועדפים העדכניים של המשתמש המחובר, או null (אחרי רישום) אם הקריאה נכשלה */
async function readCurrentFavorites(
  supabase: SupabaseClient,
): Promise<string[] | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    console.error("[favorites] read current failed:", error);
    return null;
  }
  return readFavorites(data.user);
}

/** כותב את הרשימה החדשה, ומחזיר את מה שנשמר בפועל */
async function writeFavorites(
  supabase: SupabaseClient,
  next: string[],
  context: string,
): Promise<FavoritesResult> {
  try {
    const { data, error } = await supabase.auth.updateUser({
      data: { [FAVORITES_METADATA_KEY]: next },
    });
    if (error) return fail(context, error);
    return { ok: true, favorites: readFavorites(data.user) };
  } catch (error: unknown) {
    return fail(context, error);
  }
}

/** מעדכן את הרשימה העדכנית; בלי כתיבה כשהתוצאה זהה למה שכבר שמור */
async function updateFavorites(
  supabase: SupabaseClient,
  context: string,
  change: (current: readonly string[]) => string[],
): Promise<FavoritesResult> {
  try {
    const current = await readCurrentFavorites(supabase);
    if (current === null) return { ok: false };
    const next = change(current);
    const isUnchanged =
      next.length === current.length &&
      next.every((id, i) => id === current[i]);
    if (isUnchanged) return { ok: true, favorites: current };
    return await writeFavorites(supabase, next, context);
  } catch (error: unknown) {
    return fail(context, error);
  }
}

export function addFavorite(
  supabase: SupabaseClient,
  studentId: string,
): Promise<FavoritesResult> {
  return updateFavorites(supabase, "add", (current) =>
    current.includes(studentId) ? [...current] : [...current, studentId],
  );
}

export function removeFavorite(
  supabase: SupabaseClient,
  studentId: string,
): Promise<FavoritesResult> {
  return updateFavorites(supabase, "remove", (current) =>
    current.filter((id) => id !== studentId),
  );
}

/** מנקה את כל המועדפים של המשתמש המחובר */
export function clearFavorites(
  supabase: SupabaseClient,
): Promise<FavoritesResult> {
  return writeFavorites(supabase, [], "clear");
}
