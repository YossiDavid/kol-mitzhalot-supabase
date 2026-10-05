import type { SupabaseClient } from "@supabase/supabase-js";

/** עוזרים משותפים לבדיקות יומן ההצעות, המכסה וההשהיה */

export interface EventRow {
  id: string;
  shidduch_id: string;
  shadchan_id: string;
  student_id: string;
  other_student_id: string;
  side: "groom" | "bride";
  kind: string;
  created_at: string;
  shadchan_name: string | null;
  student_name: string | null;
  other_student_name: string | null;
}

const EVENT_COLUMNS =
  "id, shidduch_id, shadchan_id, student_id, other_student_id, side, kind, created_at, shadchan_name, student_name, other_student_name";

export async function listEvents(
  admin: SupabaseClient,
  studentIds: string[],
): Promise<EventRow[]> {
  const { data, error } = await admin
    .from("shidduch_events")
    .select(EVENT_COLUMNS)
    .in("student_id", studentIds)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`קריאת יומן ההצעות נכשלה: ${error.message}`);
  return (data ?? []) as EventRow[];
}

export async function clearEvents(
  admin: SupabaseClient,
  studentIds: string[],
): Promise<void> {
  const { error } = await admin
    .from("shidduch_events")
    .delete()
    .in("student_id", studentIds);
  if (error) throw new Error(`ניקוי יומן ההצעות נכשל: ${error.message}`);
}

/** אירוע ישן שנכתב ישירות, כדי למלא מכסה בלי לעבור שליחה אמיתית */
export async function seedEvent(
  admin: SupabaseClient,
  params: {
    shadchanId: string;
    shadchanName?: string;
    studentId: string;
    otherStudentId: string;
    side: "groom" | "bride";
    createdAt: Date;
    shidduchId?: string;
  },
): Promise<void> {
  const { error } = await admin.from("shidduch_events").insert({
    shidduch_id: params.shidduchId ?? crypto.randomUUID(),
    shadchan_id: params.shadchanId,
    shadchan_name: params.shadchanName ?? "שדכן בדיקה",
    student_id: params.studentId,
    other_student_id: params.otherStudentId,
    student_name: "כרטיס בדיקה",
    other_student_name: "כרטיס מוצע",
    side: params.side,
    created_at: params.createdAt.toISOString(),
  });
  if (error) throw new Error(`הוספת אירוע לבדיקה נכשלה: ${error.message}`);
}

export const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000);

export const daysAgo = (days: number) => hoursAgo(days * 24);

type Scope = "both" | "groom_only" | "bride_only";

/**
 * שליחה בשני השלבים ש-offer/route.ts מבצע: קודם השורה נכתבת כ-sent בלי
 * sent_at (לפני המייל), ואחרי המייל נקבע sent_at. מחזיר את מזהה ההצעה,
 * או את שגיאת הכתיבה הראשונה (הטריגר מסרב) - בלי לזרוק.
 */
export async function simulateSend(
  admin: SupabaseClient,
  params: {
    groomId: string;
    brideId: string;
    shadchanId: string;
    scope: Scope;
    reuseId?: string;
  },
): Promise<{ id: string | null; error: string | null }> {
  const base = {
    groom_id: params.groomId,
    bride_id: params.brideId,
    shadchan_id: params.shadchanId,
    status: "sent",
    recipient_scope: params.scope,
    sent_at: null as string | null,
  };

  const write = params.reuseId
    ? admin.from("shidduchim").update(base).eq("id", params.reuseId)
    : admin.from("shidduchim").insert(base);
  const { data, error } = await write.select("id").single();
  if (error || !data) return { id: null, error: error?.message ?? "no row" };

  const { error: finishError } = await admin
    .from("shidduchim")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", data.id);
  if (finishError) return { id: data.id, error: finishError.message };

  return { id: data.id as string, error: null };
}

/** מחזיר מכסה/השהיה של כרטיס למצב נקי */
export async function resetCardRules(
  admin: SupabaseClient,
  studentIds: string[],
): Promise<void> {
  const { error } = await admin
    .from("students")
    .update({
      proposal_limit_count: null,
      proposal_limit_period: null,
      in_shidduchim: true,
      admin_paused_at: null,
      admin_paused_by: null,
    })
    .in("id", studentIds);
  if (error) throw new Error(`איפוס כללי הכרטיס נכשל: ${error.message}`);
}
