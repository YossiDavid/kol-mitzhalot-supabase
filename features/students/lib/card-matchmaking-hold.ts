import type { SupabaseClient } from "@supabase/supabase-js";

/** "בתהליך שידוך": הכרטיס זמנית אינו מקבל הצעות חדשות */
export type MatchmakingHold = { since: string; reason: string | null };

export const MATCHMAKING_HOLD_REASON_MAX_LENGTH = 300;

/**
 * מצב "בתהליך שידוך" של כרטיס, לבעלים, לשדכן ולמנהל (get_card_matchmaking_hold).
 * null כשהכרטיס אינו בתהליך, או כשהבדיקה נכשלה (נרשם).
 */
export async function loadMatchmakingHold(
  supabase: SupabaseClient,
  studentId: string,
): Promise<MatchmakingHold | null> {
  const { data, error } = await supabase.rpc("get_card_matchmaking_hold", {
    p_student_id: studentId,
  });
  if (error) {
    console.error("[students/matchmaking-hold] lookup failed", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.hold_at) return null;
  return { since: row.hold_at, reason: row.reason ?? null };
}

/** שורה ברשימה עם מצב "בתהליך שידוך" (לכוכב בצבע השונה) */
export type WithMatchmakingHold = {
  matchmaking_hold_reason?: string | null;
  is_on_matchmaking_hold?: boolean;
};

/**
 * מוסיף לכל שורה את מצב "בתהליך שידוך" (students_on_matchmaking_hold - לשדכן
 * ולמנהל; לאחרים חוזר ריק). כשל אינו מפיל את הרשימה: השורות חוזרות כמו שהן.
 */
export async function withMatchmakingHold<T extends { id: string }>(
  supabase: SupabaseClient,
  rows: readonly T[],
): Promise<(T & WithMatchmakingHold)[]> {
  if (rows.length === 0) return [...rows];
  const { data, error } = await supabase.rpc("students_on_matchmaking_hold", {
    p_ids: rows.map((row) => row.id),
  });
  if (error) {
    console.error("[students/matchmaking-hold] list lookup failed", error.message);
    return [...rows];
  }
  const reasons = new Map<string, string | null>(
    ((data ?? []) as { student_id: string; reason: string | null }[]).map(
      (row) => [row.student_id, row.reason],
    ),
  );
  return rows.map((row) =>
    reasons.has(row.id)
      ? {
          ...row,
          is_on_matchmaking_hold: true,
          matchmaking_hold_reason: reasons.get(row.id) ?? null,
        }
      : row,
  );
}
