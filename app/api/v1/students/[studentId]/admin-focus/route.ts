import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminFocusBodySchema } from "@/features/students/lib/card-admin-focus";
import { createAdminClient } from "@/lib/supabase/admin";
import { describeSupabaseError } from "@/lib/supabase/describe-error";
import { createClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/user";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * סימון כרטיס "במיקוד" ע"י הנהלת המערכת (עם הערה קצרה), והסרת הסימון.
 * למנהל מערכת בלבד. הכתיבה ב-service role: לטבלה student_admin_focus אין
 * הרשאות ללקוחות כלל, ולכן שום משתמש אחר אינו יכול לסמן גם בעקיפת הנתיב.
 * אין הודעה לבעל הכרטיס - הסימון גלוי לשדכנים ולמנהלים בלבד.
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
  const parsed = adminFocusBodySchema.safeParse(payload);
  if (!parsed.success) return jsonError("הערה ארוכה מדי או בקשה לא תקינה", 400);

  const admin = createAdminClient();
  const { data: student, error: readError } = await admin
    .from("students")
    .select("id")
    .eq("id", studentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) {
    console.error(
      "[students/admin-focus] read failed",
      studentId,
      describeSupabaseError(readError),
    );
    return jsonError("שגיאת מסד", 500);
  }
  if (!student) return jsonError("הכרטיס לא נמצא", 404);

  const { error } = parsed.data.focused
    ? await admin.from("student_admin_focus").upsert(
        {
          student_id: studentId,
          focused_at: new Date().toISOString(),
          focused_by: user.id,
          note: parsed.data.note,
        },
        { onConflict: "student_id" },
      )
    : await admin
        .from("student_admin_focus")
        .delete()
        .eq("student_id", studentId);
  if (error) {
    console.error(
      "[students/admin-focus] write failed",
      studentId,
      describeSupabaseError(error),
    );
    return jsonError("עדכון המיקוד נכשל", 500);
  }

  return NextResponse.json({
    ok: true,
    focused: parsed.data.focused,
    note: parsed.data.focused ? parsed.data.note : null,
  });
}
