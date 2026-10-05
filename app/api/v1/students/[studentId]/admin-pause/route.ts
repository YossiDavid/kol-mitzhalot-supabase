import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isOutOfShidduchimStatus } from "@/features/students/lib/student-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

const bodySchema = z.object({ paused: z.boolean() });

/**
 * השהיית כרטיס ע"י הנהלת המערכת, ובטלה. כל עוד הכרטיס מושהה כך, מנהל
 * הכרטיס אינו יכול להחזיר אותו לשידוכים - הנעילה נאכפת בטריגר
 * enforce_student_admin_pause ולא רק ב-UI. הצעות קיימות אינן נוגעות.
 *
 * ביטול השהיה מחזיר את הכרטיס לשידוכים, אלא אם הוא מאורס או נשוי
 * (אותו כלל כמו ב-PATCH של הסטטוס).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(user, "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: student, error: readError } = await admin
    .from("students")
    .select("id, personal_status")
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError) {
    console.error(
      "[students/admin-pause] read failed",
      studentId,
      describeSupabaseError(readError),
    );
    return NextResponse.json({ error: "שגיאת מסד" }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ error: "הכרטיס לא נמצא" }, { status: 404 });
  }

  const patch = parsed.data.paused
    ? {
        admin_paused_at: new Date().toISOString(),
        admin_paused_by: user.id,
        in_shidduchim: false,
      }
    : {
        admin_paused_at: null,
        admin_paused_by: null,
        in_shidduchim: !isOutOfShidduchimStatus(student.personal_status),
      };

  const { data: updated, error: updateError } = await admin
    .from("students")
    .update(patch)
    .eq("id", studentId)
    .select("id, in_shidduchim, admin_paused_at")
    .maybeSingle();

  if (updateError || !updated) {
    console.error(
      "[students/admin-pause] update failed",
      studentId,
      updateError ? describeSupabaseError(updateError) : "no row",
    );
    return NextResponse.json({ error: "עדכון ההשהיה נכשל" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: updated });
}
