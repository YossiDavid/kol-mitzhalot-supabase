import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendCardApprovalEmail } from "@/features/notifications/lib/send-card-approval-email";
import {
  REJECTION_REASON_MAX_LENGTH,
  REJECTION_REASON_MIN_LENGTH,
} from "@/features/students/lib/card-approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("reject"),
    reason: z
      .string()
      .trim()
      .min(REJECTION_REASON_MIN_LENGTH)
      .max(REJECTION_REASON_MAX_LENGTH),
  }),
]);

const RETURNED_COLUMNS =
  "id, user_id, first_name, last_name, admin_approved_at, admin_rejected_at, admin_rejection_reason";

const CLEARED_APPROVAL = {
  admin_approved_at: null,
  admin_approved_by: null,
  admin_rejected_at: null,
  admin_rejected_by: null,
  admin_rejection_reason: null,
} as const;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * אישור או דחייה (עם סיבה) של כרטיס על ידי מנהל מערכת. דחייה חלה גם על כרטיס
 * שכבר אושר, וזו הדרך להסיר אותו מהשדכנים עם הסבר לבעליו. הכתיבה ב-service
 * role, והמסד (enforce_student_admin_approval_lock) מונע מכל כותב אחר לשנות
 * את עמודות האישור. ההתראה לבעל הכרטיס נוצרת במסד; המייל נשלח מכאן.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!z.uuid().safeParse(studentId).success) {
    return jsonError("מזהה כרטיס לא תקין", 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("נדרשת התחברות", 401);
  if (!hasRole(user, "admin")) return jsonError("אין הרשאה", 403);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError("בקשה לא תקינה", 400);
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(
      `יש לכתוב סיבת דחייה (${REJECTION_REASON_MIN_LENGTH}-${REJECTION_REASON_MAX_LENGTH} תווים)`,
      400,
    );
  }
  const body = parsed.data;

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("students")
    .select("id, admin_approved_at, admin_rejected_at")
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) {
    console.error(
      "[students/approval] read failed",
      studentId,
      describeSupabaseError(readError),
    );
    return jsonError("שגיאת מסד", 500);
  }
  if (!current) return jsonError("הכרטיס לא נמצא", 404);
  if (body.action === "approve" && current.admin_approved_at) {
    return jsonError("הכרטיס כבר מאושר", 409);
  }

  const now = new Date().toISOString();
  const patch =
    body.action === "approve"
      ? {
          ...CLEARED_APPROVAL,
          admin_approved_at: now,
          admin_approved_by: user.id,
        }
      : {
          ...CLEARED_APPROVAL,
          admin_rejected_at: now,
          admin_rejected_by: user.id,
          admin_rejection_reason: body.reason,
        };

  const { data: updated, error: updateError } = await admin
    .from("students")
    .update(patch)
    .eq("id", studentId)
    .select(RETURNED_COLUMNS)
    .maybeSingle();
  if (updateError || !updated) {
    console.error(
      "[students/approval] update failed",
      studentId,
      updateError ? describeSupabaseError(updateError) : "no row",
    );
    return jsonError("עדכון האישור נכשל", 500);
  }

  // מנהל שמכריע על כרטיס שלו עצמו אינו מקבל מייל על כך
  if (updated.user_id !== user.id) {
    await sendCardApprovalEmail({
      ownerId: updated.user_id,
      studentId,
      candidateName: `${updated.first_name} ${updated.last_name}`,
      decision: body.action === "approve" ? "approved" : "rejected",
      reason: body.action === "reject" ? body.reason : null,
    });
  }

  return NextResponse.json({
    ok: true,
    row: {
      id: updated.id,
      admin_approved_at: updated.admin_approved_at,
      admin_rejected_at: updated.admin_rejected_at,
      admin_rejection_reason: updated.admin_rejection_reason,
    },
  });
}

/**
 * שליחה לאישור מחדש: בעל כרטיס שנדחה מחזיר אותו ל"ממתין". הכתיבה בסשן של
 * המשתמש - המסד מתיר בדיוק את המעבר הזה לבעל הכרטיס ולא שום שינוי אחר בעמודות
 * האישור, והמנהלים מקבלים התראה (notify_admins_card_pending_approval).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!z.uuid().safeParse(studentId).success) {
    return jsonError("מזהה כרטיס לא תקין", 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("נדרשת התחברות", 401);

  const { data, error } = await supabase
    .from("students")
    .update(CLEARED_APPROVAL)
    .eq("id", studentId)
    .eq("user_id", user.id)
    .not("admin_rejected_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(
      "[students/approval] resubmit failed",
      studentId,
      describeSupabaseError(error),
    );
    return jsonError("השליחה לאישור נכשלה", 500);
  }
  if (!data) {
    return jsonError("אפשר לשלוח לאישור מחדש רק כרטיס שלך שנדחה", 409);
  }
  return NextResponse.json({ ok: true });
}
