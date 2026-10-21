import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendCardApprovalEmail } from "@/features/notifications/lib/send-card-approval-email";
import {
  REJECTION_REASON_MAX_LENGTH,
  REJECTION_REASON_MIN_LENGTH,
  SILENT_REJECTION_DEFAULT_REASON,
} from "@/features/students/lib/card-approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  // מאושר להצעות המנהל בלבד: אינו מופיע במאגר (card-approval.ts)
  z.object({ action: z.literal("exclusive") }),
  z
    .object({
      action: z.literal("reject"),
      // "ללא שליחת הודעה לבעל הכרטיס": בלי התראה ובלי מייל, והסיבה רשות
      silent: z.boolean().default(false),
      reason: z.string().trim().max(REJECTION_REASON_MAX_LENGTH).default(""),
    })
    .refine(
      (body) =>
        body.silent || body.reason.length >= REJECTION_REASON_MIN_LENGTH,
      { path: ["reason"] },
    ),
  // החזרה להמתנה של כרטיס שנדחה (למשל דחייה בטעות) או בלעדי למנהל, בלי הודעה
  // לבעליו
  z.object({ action: z.literal("reset") }),
]);

const RETURNED_COLUMNS =
  "id, user_id, first_name, last_name, admin_approved_at, admin_rejected_at, admin_rejection_reason, admin_exclusive_at";

const CLEARED_APPROVAL = {
  admin_approved_at: null,
  admin_approved_by: null,
  admin_rejected_at: null,
  admin_rejected_by: null,
  admin_rejection_reason: null,
  admin_exclusive_at: null,
  admin_exclusive_by: null,
} as const;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

type ApprovalBody = z.infer<typeof bodySchema>;

type CurrentApproval = {
  admin_approved_at: string | null;
  admin_approved_by: string | null;
  admin_rejected_at: string | null;
  admin_exclusive_at: string | null;
};

/** הסירוב לפעולה שאינה מתאימה למצב הנוכחי, או null */
function transitionError(
  action: ApprovalBody["action"],
  current: CurrentApproval,
): string | null {
  if (
    action === "approve" &&
    current.admin_approved_at &&
    !current.admin_exclusive_at
  ) {
    return "הכרטיס כבר מאושר";
  }
  if (action === "exclusive" && current.admin_exclusive_at) {
    return "הכרטיס כבר מאושר להצעות ממך בלבד";
  }
  if (
    action === "reset" &&
    !current.admin_rejected_at &&
    !current.admin_exclusive_at
  ) {
    return "אפשר להחזיר להמתנה רק כרטיס שנדחה או שאושר להצעות ממך בלבד";
  }
  return null;
}

/**
 * העדכון לכל פעולה. admin_review_silent נכתב תמיד, באותו עדכון: הטריגרים של
 * ההתראות (20261027130000_admin_review_silent.sql) קוראים אותו מהשורה החדשה.
 * "בלעדי" לכרטיס שכבר מאושר שומר את רגע האישור המקורי (אין התראת "אושר" נוספת).
 */
function buildPatch(
  body: ApprovalBody,
  adminId: string,
  current: CurrentApproval,
) {
  const now = new Date().toISOString();
  if (body.action === "exclusive") {
    return {
      ...CLEARED_APPROVAL,
      admin_approved_at: current.admin_approved_at ?? now,
      admin_approved_by: current.admin_approved_at
        ? current.admin_approved_by
        : adminId,
      admin_exclusive_at: now,
      admin_exclusive_by: adminId,
      admin_review_silent: false,
    };
  }
  if (body.action === "approve") {
    return {
      ...CLEARED_APPROVAL,
      admin_approved_at: now,
      admin_approved_by: adminId,
      admin_review_silent: false,
    };
  }
  if (body.action === "reset") {
    return { ...CLEARED_APPROVAL, admin_review_silent: true };
  }
  return {
    ...CLEARED_APPROVAL,
    admin_rejected_at: now,
    admin_rejected_by: adminId,
    admin_rejection_reason: body.reason || SILENT_REJECTION_DEFAULT_REASON,
    admin_review_silent: body.silent,
  };
}

/**
 * אישור או דחייה (עם סיבה) של כרטיס על ידי מנהל מערכת. דחייה חלה גם על כרטיס
 * שכבר אושר, וזו הדרך להסיר אותו מהשדכנים עם הסבר לבעליו. דחייה "שקטה" (silent)
 * אינה שולחת התראה ומייל, והסיבה בה רשות. "exclusive" מאשר להצעות המנהל בלבד
 * (הכרטיס אינו מופיע במאגר); "approve" מכרטיס כזה מעביר אותו לאישור מלא.
 * "reset" מחזיר כרטיס שנדחה או בלעדי להמתנה, בלי הודעה לאיש. הכתיבה ב-service
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
    .select(
      "id, admin_approved_at, admin_approved_by, admin_rejected_at, admin_exclusive_at",
    )
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
  const refusal = transitionError(body.action, current);
  if (refusal) return jsonError(refusal, 409);

  const patch = buildPatch(body, user.id, current);
  const isSilent = patch.admin_review_silent;
  // מבחינת בעל הכרטיס "בלעדי" הוא אישור: מייל רק במעבר ממצב לא מאושר למאושר
  const isNewlyApproved =
    (body.action === "approve" || body.action === "exclusive") &&
    !current.admin_approved_at;

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

  // מנהל שמכריע על כרטיס שלו עצמו אינו מקבל מייל על כך; הכרעה שקטה והחזרה
  // להמתנה - אין מייל (גם ההתראה בפעמון מושתקת במסד, admin_review_silent)
  if (
    updated.user_id !== user.id &&
    !isSilent &&
    (isNewlyApproved || body.action === "reject")
  ) {
    await sendCardApprovalEmail({
      ownerId: updated.user_id,
      studentId,
      candidateName: `${updated.first_name} ${updated.last_name}`,
      decision: body.action === "reject" ? "rejected" : "approved",
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
      admin_exclusive_at: updated.admin_exclusive_at,
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

  // admin_review_silent מתאפס: שליחה לאישור מחדש מודיעה למנהלים, גם אחרי
  // דחייה שקטה
  const { data, error } = await supabase
    .from("students")
    .update({ ...CLEARED_APPROVAL, admin_review_silent: false })
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
