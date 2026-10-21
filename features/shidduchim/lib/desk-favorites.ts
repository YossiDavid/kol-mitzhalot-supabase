import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { DESK_STUDENT_SELECT } from "@/features/shidduchim/lib/desk-student-select";
import {
  STUDENT_CARDS_VIEW,
  keepFavoritable,
  type FavoritableColumns,
} from "@/features/students/lib/third-party-card";

/**
 * המועדפים של לוח העבודה (בשרת ובלקוח): הכרטיסים מ-student_cards, ולכל אחד
 * הדגל is_in_process (הצעה פתוחה בסטטוס "מעוניינים"/"בתהליך" של כל שדכן).
 * כשל בבדיקת "בתהליך" אינו מפיל את הלוח - התג פשוט לא מוצג, והכשל נרשם.
 */

/** כמה מזהים students_in_process מקבלת בקריאה אחת (כמו במסד) */
const IN_PROCESS_MAX_IDS = 500;

export type DeskFavoritesResult<T> =
  | { ok: true; data: Array<T & { is_in_process: boolean }> }
  | { ok: false; error: PostgrestError };

async function loadInProcessIds(
  supabase: SupabaseClient,
  ids: readonly string[],
): Promise<ReadonlySet<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase.rpc("students_in_process", {
    p_student_ids: ids.slice(0, IN_PROCESS_MAX_IDS),
  });
  if (error) {
    console.error(
      "[canvas] students_in_process failed",
      describeSupabaseError(error),
    );
    return new Set();
  }
  return new Set(Array.isArray(data) ? data.map(String) : []);
}

export async function loadDeskFavorites<
  T extends { id: string } & FavoritableColumns,
>(
  supabase: SupabaseClient,
  favoriteIds: readonly string[],
): Promise<DeskFavoritesResult<T>> {
  const { data, error } = await supabase
    .from(STUDENT_CARDS_VIEW)
    .select(DESK_STUDENT_SELECT)
    .in("id", [...favoriteIds]);

  if (error) return { ok: false, error };

  // כרטיס שלא אושר להצעות (אישור ההנהלה, או צד שלישי) לא עולה ללוח - נשאר
  // במטא-דאטה וחוזר באישור
  const cards = keepFavoritable((data ?? []) as unknown as T[]);
  const inProcess = await loadInProcessIds(
    supabase,
    cards.map((card) => card.id),
  );
  return {
    ok: true,
    data: cards.map((card) => ({
      ...card,
      is_in_process: inProcess.has(card.id),
    })),
  };
}
