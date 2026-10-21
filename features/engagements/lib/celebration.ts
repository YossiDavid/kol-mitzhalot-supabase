import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * חגיגת שידוכים בכניסה ל-/app. ההחלטה מה להציג (ומתי היעדרות נחשבת
 * ארוכה - 30 יום) נעשית ב-check_celebration; ראו
 * supabase/migrations/20261101300000_shidduch_celebrations.sql.
 */

export type CelebrationKind = "none" | "new" | "welcome_back";

export type Celebration = {
  kind: Exclude<CelebrationKind, "none">;
  count: number;
};

const statusSchema = z.object({
  kind: z.enum(["none", "new", "welcome_back"]),
  new_count: z.number().int().min(0),
});

/** null - אין מה לחגוג (או תקלה: חגיגה אינה שווה הודעת שגיאה) */
export async function fetchCelebration(
  supabase: SupabaseClient,
): Promise<Celebration | null> {
  const { data, error } = await supabase.rpc("check_celebration");
  if (error) {
    console.error("[celebration] check", error.message);
    return null;
  }
  const parsed = z.array(statusSchema).safeParse(data ?? []);
  const row = parsed.success ? parsed.data[0] : undefined;
  if (!row || row.kind === "none" || row.new_count === 0) return null;
  return { kind: row.kind, count: row.new_count };
}

export async function markCelebrationSeen(
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.rpc("mark_celebration_seen");
  if (error) console.error("[celebration] mark seen", error.message);
}

/** "נסגר שידוך חדש" / "נסגרו 3 שידוכים חדשים" */
export function newShidduchimText(count: number): string {
  return count === 1
    ? "מזל טוב! נסגר שידוך חדש במערכת"
    : `מזל טוב! נסגרו ${count} שידוכים חדשים במערכת`;
}

export function welcomeBackText(count: number): string {
  const closed = count === 1 ? "נסגר שידוך אחד" : `נסגרו ${count} שידוכים`;
  return `מאז ביקורך האחרון ${closed} במערכת — מזל טוב!`;
}
