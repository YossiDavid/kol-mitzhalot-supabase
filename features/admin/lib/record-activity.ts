import type { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";

/**
 * רישום ביומן הפעילות מנתיב שרת, לפעולות שאין להן טריגר במסד (תפקידים
 * יושבים ב-app_metadata של auth). ב-service role, דרך activity_record - כשל
 * ברישום אינו מכשיל את הפעולה עצמה, ורק נרשם בלוג.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export type ActivityEntry = {
  actorId: string;
  action: string;
  entityType: string;
  /** null = פעולה בלי ישות אחת (למשל הודעה לכל השדכנים) */
  entityId: string | null;
  summary: string;
  /** שמות שדות וערכי סטטוס בלבד - לא פרטים אישיים */
  details: Record<string, unknown>;
};

export async function recordActivity(
  admin: AdminClient,
  entry: ActivityEntry,
): Promise<void> {
  const { error } = await admin.rpc("activity_record", {
    p_actor: entry.actorId,
    p_action: entry.action,
    p_entity_type: entry.entityType,
    p_entity_id: entry.entityId,
    p_summary: entry.summary,
    p_details: entry.details,
  });
  if (error) {
    console.error(
      "[activity] record failed",
      entry.action,
      describeSupabaseError(error),
    );
  }
}
