import { createAdminClient } from "@/lib/supabase/admin";

/**
 * מזהי הכרטיסים (מתוך הרשימה) שמושהים בידי ההנהלה בהשהיה שקטה. נשלף
 * ב-service role כי הדגל אינו חלק מה-view. כשל: קבוצה ריקה (בלי מיסוך).
 */
export async function loadSilentlyPausedIds(
  studentIds: readonly string[],
): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set();
  try {
    const { data, error } = await createAdminClient()
      .from("students")
      .select("id")
      .in("id", [...studentIds])
      .eq("admin_pause_silent", true)
      .not("admin_paused_at", "is", null);
    if (error) {
      console.error("[students/silent-pause] lookup failed", error);
      return new Set();
    }
    return new Set((data ?? []).map((row) => row.id));
  } catch (error) {
    console.error("[students/silent-pause] lookup failed", error);
    return new Set();
  }
}

type PausableRow = {
  id: string;
  in_shidduchim?: boolean | null;
  admin_paused_at?: string | null;
};

/**
 * מה שמנהל הכרטיס רואה: כרטיס בהשהיה שקטה מוצג כפעיל (בשידוכים, בלי
 * השהיית הנהלה). רק לבעלים שאינו מנהל - מנהל ושדכן רואים את המצב האמיתי.
 */
export async function maskSilentPauseForOwner<T extends PausableRow>(
  rows: readonly T[],
): Promise<T[]> {
  const candidates = rows.filter((row) => row.in_shidduchim === false);
  const silent = await loadSilentlyPausedIds(candidates.map((row) => row.id));
  if (silent.size === 0) return [...rows];
  return rows.map((row) =>
    silent.has(row.id)
      ? { ...row, in_shidduchim: true, admin_paused_at: null }
      : row,
  );
}
