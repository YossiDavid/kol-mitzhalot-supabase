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
