import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { isOutOfShidduchimStatus } from "@/features/students/lib/student-status";

/**
 * קישור השיתוף הציבורי (גולש לא מחובר) נקרא ב-service role, ולכן מצב הכרטיס
 * נבדק כאן ולא ב-RLS. כרטיס אינו נפתח בקישור כשהוא:
 * - בלעדי למנהל (לא במאגר)
 * - מושהה על ידי ההנהלה
 * - מחוץ לשידוכים (in_shidduchim = false) או מאורס / נשוי
 * - בהקפאת שידוכים
 * כשל בבדיקה = לא נפתח (fail closed).
 */
const GATE_COLUMNS =
  "admin_exclusive_at, admin_paused_at, in_shidduchim, personal_status, matchmaking_hold_at";

type GateRow = {
  admin_exclusive_at: string | null;
  admin_paused_at: string | null;
  in_shidduchim: boolean | null;
  personal_status: string | null;
  matchmaking_hold_at: string | null;
};

export function isOpenForPublicShare(row: GateRow): boolean {
  return (
    !row.admin_exclusive_at &&
    !row.admin_paused_at &&
    row.in_shidduchim !== false &&
    !isOutOfShidduchimStatus(row.personal_status ?? undefined) &&
    !row.matchmaking_hold_at
  );
}

export async function canOpenPublicShare(studentId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("students")
    .select(GATE_COLUMNS)
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    console.error(
      "[students/share] gate lookup failed",
      describeSupabaseError(error),
    );
    return false;
  }
  return data ? isOpenForPublicShare(data as GateRow) : false;
}
