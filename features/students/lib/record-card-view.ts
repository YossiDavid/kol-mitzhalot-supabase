import type { createClient } from "@/lib/supabase/server";
import { describeSupabaseError } from "@/lib/supabase/describe-error";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Records that the signed-in shadchan opened a student card (feeds "שדכנים שפעלו בשבילך").
 * Never throws: tracking must not break or slow the card page. The DB decides who counts
 * (shadchan role, not the owner) — this just skips the call when it obviously won't.
 */
export async function recordStudentCardView(
  supabase: ServerSupabase,
  studentId: string,
): Promise<void> {
  try {
    const { error } = await supabase.rpc("record_student_card_view", {
      p_student_id: studentId,
    });
    if (error) {
      console.error("[students/card-view]", describeSupabaseError(error));
    }
  } catch (err) {
    console.error("[students/card-view]", err);
  }
}
